import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { sendSuccess, sendPaginatedResponse } from '../utils/response.js';
import { generateInvoice } from '../utils/invoiceGenerator.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Payment from '../models/Payment.js';
import { emitToUser, emitToAdmins } from '../sockets/socketHandler.js';

/**
 * @desc    Create Order
 * @route   POST /api/orders
 * @access  Private (Customer)
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddressId, paymentMethod, notes } = req.body;

  // Validate payment method
  if (!paymentMethod || !['COD', 'Razorpay'].includes(paymentMethod)) {
    throw new AppError('Invalid payment method', 400);
  }

  // Get user cart
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  // Get shipping address
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

  // Verify stock availability for all items
  for (const item of cart.items) {
    const product = await Product.findById(item.product._id);

    if (!product || !product.isActive) {
      throw new AppError(`Product ${item.product.name} is no longer available`, 400);
    }

    if (product.stock < item.quantity) {
      throw new AppError(
        `Insufficient stock for ${item.product.name}. Only ${product.stock} available`,
        400
      );
    }
  }

  // Prepare order items
  const orderItems = cart.items.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    partNumber: item.product.partNumber,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    image: item.product.images[0]?.url,
  }));

  // Create order
  const order = await Order.create({
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
  });

  // Create payment record
  await Payment.create({
    order: order._id,
    user: req.user._id,
    amount: order.totalAmount,
    paymentMethod,
    paymentStatus: 'Pending',
  });

  // Reduce product stock
  for (const item of cart.items) {
    const product = await Product.findById(item.product._id);
    product.stock -= item.quantity;
    product.totalSales += item.quantity;
    await product.save();
  }

  // Clear cart
  cart.items = [];
  await cart.save();

  // Populate order
  await order.populate('user', 'name email phone');

  // Emit real-time notification to user
  emitToUser(req.user._id.toString(), 'order_placed', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
  });

  // Emit notification to all admins
  emitToAdmins('new_order', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerName: req.user.name,
    totalAmount: order.totalAmount,
  });

  sendSuccess(res, 201, 'Order placed successfully', { order });
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
  if (order.user.toString() !== req.user._id.toString()) {
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
    order.statusHistory[order.statusHistory.length - 1].note = note;
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
