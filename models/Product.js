import mongoose from 'mongoose';

/**
 * Product Schema
 * Stores Hyundai spare parts information with images, pricing, and stock
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    partNumber: {
      type: String,
      required: [true, 'Part number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Engine', 'Brake', 'Electrical', 'Body', 'Accessories', 'Suspension', 'Transmission', 'Interior', 'Exterior'],
    },
    subcategory: {
      type: String,
      trim: true,
    },
    compatibleModels: [
      {
        type: String,
        enum: ['i10', 'i20', 'Creta', 'Verna', 'Venue', 'Elantra', 'Tucson', 'Kona', 'Alcazar', 'Aura', 'Grand i10 Nios', 'Santro'],
      },
    ],
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
      validate: {
        validator: function (value) {
          return !value || value < this.price;
        },
        message: 'Discount price must be less than original price',
      },
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: function () {
        if (this.stock === 0) return 'Out of Stock';
        if (this.stock <= 5) return 'Low Stock';
        return 'In Stock';
      },
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    ],
    specifications: {
      type: Map,
      of: String,
    },
    warrantyPeriod: {
      type: String, // e.g., "6 months", "1 year"
      default: '6 months',
    },
    manufacturer: {
      type: String,
      default: 'Hyundai',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    tags: [String],
    weight: {
      type: Number, // in kg
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        default: 'cm',
      },
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Update stock status before saving
 */
productSchema.pre('save', function (next) {
  if (this.isModified('stock')) {
    if (this.stock === 0) {
      this.stockStatus = 'Out of Stock';
    } else if (this.stock <= this.lowStockThreshold) {
      this.stockStatus = 'Low Stock';
    } else {
      this.stockStatus = 'In Stock';
    }
  }
  next();
});

/**
 * Index for searching products
 */
productSchema.index({ name: 'text', description: 'text', partNumber: 'text' });
productSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ compatibleModels: 1 });

/**
 * Virtual for final price (considering discount)
 */
productSchema.virtual('finalPrice').get(function () {
  return this.discountPrice || this.price;
});

/**
 * Exclude soft-deleted products by default
 */
productSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;
