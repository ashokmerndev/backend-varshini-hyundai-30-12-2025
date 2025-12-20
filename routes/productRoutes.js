import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { protect, adminOnly } from '../middlewares/auth.js';
import { upload } from '../config/cloudinary.js';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProductImage,
  deleteProduct,
  getProductsByCategory,
  getLowStockProducts,
  updateProductStock,
  getFeaturedProducts,
} from '../controllers/productController.js';

const router = express.Router();

/**
 * @route   GET /api/products/featured
 * @desc    Get featured products
 * @access  Public
 */
router.get('/featured', getFeaturedProducts);

/**
 * @route   GET /api/products/low-stock
 * @desc    Get low stock products
 * @access  Private (Admin)
 */
router.get('/low-stock', protect, adminOnly, getLowStockProducts);

/**
 * @route   GET /api/products/category/:category
 * @desc    Get products by category
 * @access  Public
 */
router.get('/category/:category', getProductsByCategory);

/**
 * @route   POST /api/products
 * @desc    Create product
 * @access  Private (Admin)
 */
router.post(
  '/',
  protect,
  adminOnly,
  upload.array('images', 5),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('partNumber').trim().notEmpty().withMessage('Part number is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
  ],
  validate,
  createProduct
);

/**
 * @route   GET /api/products
 * @desc    Get all products
 * @access  Public
 */
router.get('/', getAllProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get('/:id', getProductById);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  protect,
  adminOnly,
  upload.array('images', 5),
  [
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
    body('description')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Description cannot be empty'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Valid price is required'),
    body('stock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Valid stock quantity is required'),
  ],
  validate,
  updateProduct
);

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Update product stock
 * @access  Private (Admin)
 */
router.patch(
  '/:id/stock',
  protect,
  adminOnly,
  [body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required')],
  validate,
  updateProductStock
);

/**
 * @route   DELETE /api/products/:id/images/:imageId
 * @desc    Delete product image
 * @access  Private (Admin)
 */
router.delete('/:id/images/:imageId', protect, adminOnly, deleteProductImage);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', protect, adminOnly, deleteProduct);

export default router;
