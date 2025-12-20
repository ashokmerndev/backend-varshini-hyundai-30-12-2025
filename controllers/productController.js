import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { sendSuccess, sendPaginatedResponse } from '../utils/response.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import Product from '../models/Product.js';

/**
 * @desc    Create Product
 * @route   POST /api/products
 * @access  Private (Admin)
 */
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    partNumber,
    description,
    category,
    subcategory,
    compatibleModels,
    price,
    discountPrice,
    stock,
    lowStockThreshold,
    specifications,
    warrantyPeriod,
    manufacturer,
    tags,
    weight,
    dimensions,
  } = req.body;

  // Check if part number already exists
  const existingProduct = await Product.findOne({ partNumber });

  if (existingProduct) {
    throw new AppError('Product with this part number already exists', 400);
  }

  // Handle uploaded images
  const images = req.files ? req.files.map((file) => ({
    url: file.path,
    publicId: file.filename,
  })) : [];

  // Create product
  const product = await Product.create({
    name,
    partNumber,
    description,
    category,
    subcategory,
    compatibleModels: compatibleModels ? JSON.parse(compatibleModels) : [],
    price,
    discountPrice,
    stock,
    lowStockThreshold,
    images,
    specifications: specifications ? JSON.parse(specifications) : {},
    warrantyPeriod,
    manufacturer,
    tags: tags ? JSON.parse(tags) : [],
    weight,
    dimensions: dimensions ? JSON.parse(dimensions) : {},
  });

  sendSuccess(res, 201, 'Product created successfully', { product });
});

/**
 * @desc    Get All Products
 * @route   GET /api/products
 * @access  Public
 */
export const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    model,
    search,
    minPrice,
    maxPrice,
    inStock,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build query
  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  if (model) {
    query.compatibleModels = model;
  }

  if (search) {
    query.$text = { $search: search };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (inStock === 'true') {
    query.stock = { $gt: 0 };
  }

  // Calculate pagination
  const skip = (Number(page) - 1) * Number(limit);

  // Execute query
  const products = await Product.find(query)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Product.countDocuments(query);

  sendPaginatedResponse(
    res,
    200,
    'Products retrieved successfully',
    products,
    {
      total,
      page: Number(page),
      limit: Number(limit),
    }
  );
});

/**
 * @desc    Get Product By ID
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || !product.isActive) {
    throw new AppError('Product not found', 404);
  }

  sendSuccess(res, 200, 'Product retrieved successfully', { product });
});

/**
 * @desc    Update Product
 * @route   PUT /api/products/:id
 * @access  Private (Admin)
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    subcategory,
    compatibleModels,
    price,
    discountPrice,
    stock,
    lowStockThreshold,
    specifications,
    warrantyPeriod,
    manufacturer,
    tags,
    weight,
    dimensions,
    isActive,
  } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Update fields
  if (name) product.name = name;
  if (description) product.description = description;
  if (category) product.category = category;
  if (subcategory !== undefined) product.subcategory = subcategory;
  if (compatibleModels) product.compatibleModels = JSON.parse(compatibleModels);
  if (price) product.price = price;
  if (discountPrice !== undefined) product.discountPrice = discountPrice;
  if (stock !== undefined) product.stock = stock;
  if (lowStockThreshold) product.lowStockThreshold = lowStockThreshold;
  if (specifications) product.specifications = JSON.parse(specifications);
  if (warrantyPeriod) product.warrantyPeriod = warrantyPeriod;
  if (manufacturer) product.manufacturer = manufacturer;
  if (tags) product.tags = JSON.parse(tags);
  if (weight !== undefined) product.weight = weight;
  if (dimensions) product.dimensions = JSON.parse(dimensions);
  if (isActive !== undefined) product.isActive = isActive;

  // Handle new images
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => ({
      url: file.path,
      publicId: file.filename,
    }));
    product.images.push(...newImages);
  }

  await product.save();

  sendSuccess(res, 200, 'Product updated successfully', { product });
});

/**
 * @desc    Delete Product Image
 * @route   DELETE /api/products/:id/images/:imageId
 * @access  Private (Admin)
 */
export const deleteProductImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const image = product.images.id(imageId);

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  // Delete from Cloudinary
  await deleteFromCloudinary(image.publicId);

  // Remove from database
  image.deleteOne();
  await product.save();

  sendSuccess(res, 200, 'Image deleted successfully');
});

/**
 * @desc    Soft Delete Product
 * @route   DELETE /api/products/:id
 * @access  Private (Admin)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  product.isDeleted = true;
  product.isActive = false;
  await product.save();

  sendSuccess(res, 200, 'Product deleted successfully');
});

/**
 * @desc    Get Products By Category
 * @route   GET /api/products/category/:category
 * @access  Public
 */
export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 12 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const products = await Product.find({
    category,
    isActive: true,
  })
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const total = await Product.countDocuments({ category, isActive: true });

  sendPaginatedResponse(
    res,
    200,
    'Products retrieved successfully',
    products,
    {
      total,
      page: Number(page),
      limit: Number(limit),
    }
  );
});

/**
 * @desc    Get Low Stock Products
 * @route   GET /api/products/low-stock
 * @access  Private (Admin)
 */
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    stockStatus: { $in: ['Low Stock', 'Out of Stock'] },
    isActive: true,
  }).sort({ stock: 1 });

  sendSuccess(res, 200, 'Low stock products retrieved successfully', {
    products,
    count: products.length,
  });
});

/**
 * @desc    Update Product Stock
 * @route   PATCH /api/products/:id/stock
 * @access  Private (Admin)
 */
export const updateProductStock = asyncHandler(async (req, res) => {
  const { stock } = req.body;

  if (stock === undefined) {
    throw new AppError('Stock quantity is required', 400);
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  product.stock = stock;
  await product.save();

  sendSuccess(res, 200, 'Stock updated successfully', { product });
});

/**
 * @desc    Get Featured Products (Best Sellers)
 * @route   GET /api/products/featured
 * @access  Public
 */
export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isActive: true,
  })
    .sort({ totalSales: -1, averageRating: -1 })
    .limit(8);

  sendSuccess(res, 200, 'Featured products retrieved successfully', {
    products,
  });
});
