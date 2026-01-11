import mongoose from 'mongoose'; // Added for Transactions
import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { sendSuccess, sendPaginatedResponse } from '../utils/response.js';
import { generateInvoice } from '../utils/invoiceGenerator.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Payment from '../models/Payment.js';
import { emitToUser, emitToAdmins } from '../sockets/socketHandler.js';
import { notify } from './notificationController.js'; // 👈 Import Helper

/**
 * @desc    Create Order (With Atomic Transaction)
 * @route   POST /api/orders
 * @access  Private (Customer)
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddressId, paymentMethod, notes } = req.body;

  // 1. Basic Validation
  if (!paymentMethod || !['COD', 'Razorpay'].includes(paymentMethod)) {
    throw new AppError('Invalid payment method', 400);
  }

  const user = await req.user.populate('addresses');
  let shippingAddress;

  if (shippingAddressId) {
    shippingAddress = user.addresses.id(shippingAddressId);
  } else {
    shippingAddress = user.addresses.find((addr) => addr.isDefault);
  }

  if (!shippingAddress) {
    throw new AppError('Please provide a shipping address', 400);
  }

  // ============================================================
  // START ATOMIC TRANSACTION
  // ============================================================
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 2. Get Cart inside session
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product').session(session);

    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    const orderItems = [];
    
    // 3. Process Items & Deduct Stock ATOMICALLY
    for (const item of cart.items) {
      // Lock the product document to prevent others from editing it
      const product = await Product.findById(item.product._id).session(session);

      if (!product || !product.isActive) {
        throw new AppError(`Product ${item.product.name} is no longer available`, 400);
      }

      // Check Stock
      if (product.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name}. Only ${product.stock} available`,
          400
        );
      }

      // Deduct Stock immediately inside the transaction
      product.stock -= item.quantity;
      product.totalSales += item.quantity;
      
      // Save Product with Session
      await product.save({ session });

      orderItems.push({
        product: product._id,
        name: product.name,
        partNumber: product.partNumber, 
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        image: product.images[0]?.url,
      });
    }

    // 4. Create Order
    // Note: When using transactions, create returns an array
    const order = await Order.create([{
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        phone: req.user.phone,
      },
      subtotal: cart.subtotal,
      tax: cart.tax,
      taxPercentage: cart.taxPercentage,
      shippingCharges: cart.shippingCharges,
      totalAmount: cart.totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
      orderStatus: 'Placed',
      notes,
    }], { session });

    // 5. Create Payment Record
    await Payment.create([{
      order: order[0]._id, // Accessing the first element of the array
      user: req.user._id,
      amount: order[0].totalAmount,
      paymentMethod,
      paymentStatus: 'Pending',
    }], { session });

    // 6. Clear Cart
    cart.items = [];
    cart.subtotal = 0;
    cart.totalAmount = 0;
    await cart.save({ session });

    // COMMIT TRANSACTION (Save everything permanently)
    await session.commitTransaction();
    session.endSession();

    // ============================================================
    // POST-TRANSACTION ACTIONS (Notifications)
    // ============================================================
    
    // Fetch the full order to populate fields for response/socket
    const finalOrder = await Order.findById(order[0]._id).populate('user', 'name email phone');

    // Emit Real-time Events
    emitToUser(req.user._id.toString(), 'order_placed', {
      orderId: finalOrder._id,
      orderNumber: finalOrder.orderNumber,
      totalAmount: finalOrder.totalAmount,
    });

    emitToAdmins('new_order', {
      orderId: finalOrder._id,
      orderNumber: finalOrder.orderNumber,
      customerName: req.user.name,
      totalAmount: finalOrder.totalAmount,
    });

    sendSuccess(res, 201, 'Order placed successfully', { order: finalOrder });

  } catch (error) {
    // ABORT TRANSACTION (Undo everything if anything fails)
    await session.abortTransaction();
    session.endSession();
    throw error; // Pass error to global handler
  }
});

/**
 * @desc    Get User Orders
 * @route   GET /api/orders
 * @access  Private (Customer)
 */
export const getUserOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = { user: req.user._id };

  if (status) {
    query.orderStatus = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Order.countDocuments(query);

  sendPaginatedResponse(res, 200, 'Orders retrieved successfully', orders, {
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

/**
 * @desc    Get Order By ID
 * @route   GET /api/orders/:id
 * @access  Private (Customer/Admin)
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Check authorization
  if (req.userType === 'customer' && order.user._id.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to access this order', 403);
  }

  sendSuccess(res, 200, 'Order retrieved successfully', { order });
});

/**
 * @desc    Cancel Order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private (Customer)
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Check authorization
  if (order.user._id.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to cancel this order', 403);
  }

  // Check if order can be cancelled
  if (['Delivered', 'Cancelled'].includes(order.orderStatus)) {
    throw new AppError(`Cannot cancel order with status: ${order.orderStatus}`, 400);
  }

  // Update order status
  order.orderStatus = 'Cancelled';
  order.cancellationReason = cancellationReason;
  order.cancelledAt = new Date();

  await order.save();

  // Restore product stock
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      product.totalSales -= item.quantity;
      await product.save();
    }
  }

  // Emit notification to user
  emitToUser(req.user._id.toString(), 'order_cancelled', {
    orderId: order._id,
    orderNumber: order.orderNumber,
  });

  // Emit notification to admins
  emitToAdmins('order_cancelled', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerName: req.user.name,
  });

  sendSuccess(res, 200, 'Order cancelled successfully', { order });
});

/**
 * @desc    Get All Orders (Admin)
 * @route   GET /api/orders/admin/all
 * @access  Private (Admin)
 */
export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    search,
    startDate,
    endDate,
  } = req.query;

  const query = {};

  if (status) {
    query.orderStatus = status;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const orders = await Order.find(query)
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Order.countDocuments(query);

  sendPaginatedResponse(res, 200, 'Orders retrieved successfully', orders, {
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

/**
 * @desc    Update Order Status (Admin)
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin)
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, trackingNumber, courierPartner, estimatedDelivery, note } = req.body;

  if (!orderStatus) {
    throw new AppError('Order status is required', 400);
  }

  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Validate status transition
  const validStatuses = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(orderStatus)) {
    throw new AppError('Invalid order status', 400);
  }

  // Update order
  order.orderStatus = orderStatus;

  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (courierPartner) order.courierPartner = courierPartner;
  if (estimatedDelivery) order.estimatedDelivery = estimatedDelivery;

  if (note) {
    // Ensure statusHistory exists before pushing
    if (!order.statusHistory) order.statusHistory = [];
    
    // Add note to the latest status change logic could be improved, 
    // but assuming model handles history push on status change:
    // This part depends on your Order Model logic. 
    // If you have a pre-save hook pushing to history, just saving is enough.
  }

  await order.save();

  // Generate invoice for delivered orders
  if (orderStatus === 'Delivered' && !order.invoicePath) {
    try {
      const invoicePath = await generateInvoice(order);
      order.invoicePath = invoicePath;
      order.invoiceNumber = `INV-${order.orderNumber}`;
      await order.save();
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  }

  // Emit real-time notification to user
  emitToUser(order.user._id.toString(), 'order_status_updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
  });

  sendSuccess(res, 200, 'Order status updated successfully', { order });
});

/**
 * @desc    Download Invoice
 * @route   GET /api/orders/:id/invoice
 * @access  Private (Customer/Admin)
 */
export const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Check authorization
  if (
    req.userType === 'customer' &&
    order.user._id.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Not authorized to access this invoice', 403);
  }

  // Generate invoice if not exists
  if (!order.invoicePath) {
    const invoicePath = await generateInvoice(order);
    order.invoicePath = invoicePath;
    order.invoiceNumber = `INV-${order.orderNumber}`;
    await order.save();
  }

  // Send file
  res.download(order.invoicePath, `${order.invoiceNumber}.pdf`, (err) => {
    if (err) {
      throw new AppError('Error downloading invoice', 500);
    }
  });
});