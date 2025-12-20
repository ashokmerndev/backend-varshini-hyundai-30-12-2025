import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

/**
 * @desc    Get User Cart
 * @route   GET /api/cart
 * @access  Private (Customer)
 */
export const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    // Create empty cart if doesn't exist
    cart = await Cart.create({
      user: req.user._id,
      items: [],
    });
  }

  sendSuccess(res, 200, 'Cart retrieved successfully', { cart });
});

/**
 * @desc    Add Item to Cart
 * @route   POST /api/cart/add
 * @access  Private (Customer)
 */
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    throw new AppError('Product ID is required', 400);
  }

  // Verify product exists and is available
  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    throw new AppError('Product not found or unavailable', 404);
  }

  // Check stock availability
  if (product.stock < quantity) {
    throw new AppError(`Only ${product.stock} items available in stock`, 400);
  }

  // Get or create cart
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: [],
    });
  }

  // Check if product already in cart
  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId
  );

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;

    if (product.stock < newQuantity) {
      throw new AppError(`Only ${product.stock} items available in stock`, 400);
    }

    existingItem.quantity = newQuantity;
    existingItem.price = product.discountPrice || product.price;
    existingItem.subtotal = existingItem.quantity * existingItem.price;
  } else {
    // Add new item
    cart.items.push({
      product: productId,
      quantity,
      price: product.discountPrice || product.price,
      subtotal: quantity * (product.discountPrice || product.price),
    });
  }

  await cart.save();

  // Populate cart before sending
  await cart.populate('items.product', 'name partNumber images price discountPrice stock stockStatus');

  sendSuccess(res, 200, 'Item added to cart successfully', { cart });
});

/**
 * @desc    Update Cart Item Quantity
 * @route   PUT /api/cart/update/:itemId
 * @access  Private (Customer)
 */
export const updateCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400);
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const item = cart.items.id(itemId);

  if (!item) {
    throw new AppError('Item not found in cart', 404);
  }

  // Verify product stock
  const product = await Product.findById(item.product);

  if (!product || !product.isActive) {
    throw new AppError('Product not available', 404);
  }

  if (product.stock < quantity) {
    throw new AppError(`Only ${product.stock} items available in stock`, 400);
  }

  // Update quantity
  item.quantity = quantity;
  item.price = product.discountPrice || product.price;
  item.subtotal = item.quantity * item.price;

  await cart.save();

  // Populate cart
  await cart.populate('items.product', 'name partNumber images price discountPrice stock stockStatus');

  sendSuccess(res, 200, 'Cart item updated successfully', { cart });
});

/**
 * @desc    Remove Item from Cart
 * @route   DELETE /api/cart/remove/:itemId
 * @access  Private (Customer)
 */
export const removeFromCart = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const item = cart.items.id(itemId);

  if (!item) {
    throw new AppError('Item not found in cart', 404);
  }

  // Remove item
  item.deleteOne();
  await cart.save();

  // Populate cart
  await cart.populate('items.product', 'name partNumber images price discountPrice stock stockStatus');

  sendSuccess(res, 200, 'Item removed from cart successfully', { cart });
});

/**
 * @desc    Clear Cart
 * @route   DELETE /api/cart/clear
 * @access  Private (Customer)
 */
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  cart.items = [];
  await cart.save();

  sendSuccess(res, 200, 'Cart cleared successfully', { cart });
});

/**
 * @desc    Sync Cart (Update prices and availability)
 * @route   POST /api/cart/sync
 * @access  Private (Customer)
 */
export const syncCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  // Check each item's availability and price
  const updates = [];
  const removedItems = [];

  for (const item of cart.items) {
    const product = await Product.findById(item.product);

    if (!product || !product.isActive || product.stock === 0) {
      // Remove unavailable items
      removedItems.push(item);
      item.deleteOne();
      continue;
    }

    // Update price if changed
    const currentPrice = product.discountPrice || product.price;
    if (item.price !== currentPrice) {
      item.price = currentPrice;
      item.subtotal = item.quantity * item.price;
      updates.push(item);
    }

    // Adjust quantity if exceeds stock
    if (item.quantity > product.stock) {
      item.quantity = product.stock;
      item.subtotal = item.quantity * item.price;
      updates.push(item);
    }
  }

  await cart.save();

  // Populate cart
  await cart.populate('items.product', 'name partNumber images price discountPrice stock stockStatus');

  sendSuccess(res, 200, 'Cart synced successfully', {
    cart,
    updates: updates.length,
    removed: removedItems.length,
  });
});
