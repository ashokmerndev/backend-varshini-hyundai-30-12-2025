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
    // Display Part Number (e.g., "86511-C9000")
    partNumber: {
      type: String,
      required: [true, 'Part number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    // HIDDEN FIELD: Searchable Part Number (e.g., "86511c9000")
    // Helps when users search without dashes or spaces
    sanitizedPartNumber: {
      type: String,
      trim: true,
      lowercase: true,
      index: true 
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      // Categories are stable, so Enums are fine here
      enum: ['Engine', 'Brake', 'Electrical', 'Body', 'Accessories', 'Suspension', 'Transmission', 'Interior', 'Exterior', 'Service Parts'],
    },
    subcategory: {
      type: String,
      trim: true,
    },
    // MAJOR UPDATE: Improved Compatibility Logic
    // Instead of just a string, we now store Model + Year Range
    compatibleModels: [
      {
        modelName: { 
          type: String, 
          required: true,
          trim: true 
          // Note: Enum removed to allow new car launches (e.g., Exter, Ioniq 5)
        },
        yearFrom: { type: Number, required: true }, // e.g., 2015
        yearTo: { type: Number }, // e.g., 2020 (If null/undefined, it means "Till Date")
        variant: { type: String, trim: true } // Optional: e.g., "Petrol", "Diesel", "Sportz"
      }
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
          // If discountPrice is present, it must be less than price
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
      default: 'Out of Stock', // Safe default
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
      of: String, // Dynamic key-value pairs (e.g., Material: Plastic, Color: Black)
    },
    warrantyPeriod: {
      type: String, 
      default: 'No Warranty',
    },
    manufacturer: {
      type: String,
      default: 'Hyundai Mobis', // Hyundai Genuine Parts usually come from Mobis
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
 * PRE-SAVE HOOK
 * 1. Generate sanitizedPartNumber for better search
 * 2. Update stockStatus based on quantity
 */
productSchema.pre('save', function (next) {
  // Logic 1: Sanitize Part Number (Remove special chars)
  if (this.isModified('partNumber')) {
    this.sanitizedPartNumber = this.partNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  }

  // Logic 2: Update Stock Status
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
 * INDEXES
 * Crucial for fast search performance in E-commerce
 */
productSchema.index({ name: 'text', description: 'text', sanitizedPartNumber: 'text' });
productSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
// Index inside the array of objects for filtering
productSchema.index({ "compatibleModels.modelName": 1, "compatibleModels.yearFrom": 1 });

/**
 * VIRTUALS
 */
productSchema.virtual('finalPrice').get(function () {
  return this.discountPrice || this.price;
});

// Allow virtuals to show up in JSON response
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

/**
 * QUERY MIDDLEWARE
 * Exclude soft-deleted products automatically
 */
productSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;