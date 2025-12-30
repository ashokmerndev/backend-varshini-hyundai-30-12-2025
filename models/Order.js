import mongoose from 'mongoose';

/**
 * Order Schema
 * Stores customer orders with items, payment, and shipping details
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
     
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        partNumber: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        subtotal: {
          type: Number,
          required: true,
        },
        image: {
          type: String,
        },
      },
    ],
    shippingAddress: {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    taxPercentage: {
      type: Number,
      default: 18,
    },
    shippingCharges: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['COD', 'Razorpay'],
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    paymentDetails: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      paidAt: Date,
    },
    orderStatus: {
      type: String,
      required: true,
      enum: ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Placed',
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
      },
    ],
    trackingNumber: {
      type: String,
    },
    courierPartner: {
      type: String,
    },
    estimatedDelivery: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
    },
    invoicePath: {
      type: String,
    },
    invoiceNumber: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Generate unique order number before saving
 */
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get count of orders today
    const count = await mongoose.model('Order').countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    
    this.orderNumber = `ORD${year}${month}${day}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

/**
 * Add status to history when order status changes
 */
orderSchema.pre('save', function (next) {
  if (this.isModified('orderStatus')) {
    this.statusHistory.push({
      status: this.orderStatus,
      timestamp: new Date(),
    });
    
    // Set delivered date
    if (this.orderStatus === 'Delivered' && !this.deliveredAt) {
      this.deliveredAt = new Date();
    }
    
    // Set cancelled date
    if (this.orderStatus === 'Cancelled' && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  }
  next();
});

/**
 * Indexes for faster queries
 */
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });

/**
 * Populate user and product details
 */
orderSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name email phone',
  });
  next();
});

const Order = mongoose.model('Order', orderSchema);

export default Order;
