import mongoose from 'mongoose';

/**
 * Cart Schema
 * Stores user's shopping cart with items and pricing
 */
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One active cart per user
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity must be at least 1'],
          default: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        subtotal: {
          type: Number,
          required: true,
        },
      },
    ],
    totalItems: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    taxPercentage: {
      type: Number,
      default: 18, // 18% GST
    },
    shippingCharges: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Calculate cart totals before saving
 */
cartSchema.pre('save', function (next) {
  // Calculate subtotal and total items
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.subtotal = this.items.reduce((total, item) => total + item.subtotal, 0);
  
  // Calculate tax (GST)
  this.tax = (this.subtotal * this.taxPercentage) / 100;
  
  // Calculate shipping charges (free shipping above ₹5000)
  this.shippingCharges = this.subtotal >= 5000 ? 0 : 100;
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.tax + this.shippingCharges;
  
  next();
});

/**
 * Update item subtotal when quantity or price changes
 */
cartSchema.pre('save', function (next) {
  this.items.forEach((item) => {
    item.subtotal = item.quantity * item.price;
  });
  next();
});

/**
 * Populate product details when querying cart
 */
cartSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'items.product',
    select: 'name partNumber images price discountPrice stock stockStatus',
  });
  next();
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
