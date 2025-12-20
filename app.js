import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFound } from './utils/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
//import paymentRoutes from './routes/paymentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

/**
 * Initialize Express Application
 * Configure middlewares and routes
 */
const app = express();




// ============================================
// SECURITY & MIDDLEWARE CONFIGURATION
// ============================================

/**
 * CORS Configuration
 * Allow requests from frontend
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/**
 * Security Headers with Helmet
 */
app.use(helmet());

/**
 * Body Parser
 * Parse JSON and URL-encoded data
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Compression
 * Compress response bodies
 */
app.use(compression());

/**
 * MongoDB Sanitization
 * Prevent NoSQL injection attacks
 */
app.use(mongoSanitize());

/**
 * Rate Limiting
 * Limit requests from same IP
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
});

// ============================================
// ROUTES
// ============================================

/**
 * Health Check Route
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin/auth', authLimiter, adminAuthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
//app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

/**
 * API Documentation Route
 */
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hyundai Spares E-Commerce API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        refreshToken: 'POST /api/auth/refresh-token',
      },
      admin: {
        login: 'POST /api/admin/auth/login',
        profile: 'GET /api/admin/auth/profile',
      },
      products: {
        getAll: 'GET /api/products',
        getById: 'GET /api/products/:id',
        create: 'POST /api/products (Admin)',
        update: 'PUT /api/products/:id (Admin)',
      },
      cart: {
        getCart: 'GET /api/cart',
        addToCart: 'POST /api/cart/add',
        updateItem: 'PUT /api/cart/update/:itemId',
        removeItem: 'DELETE /api/cart/remove/:itemId',
      },
      orders: {
        create: 'POST /api/orders',
        getUserOrders: 'GET /api/orders',
        getById: 'GET /api/orders/:id',
        cancel: 'PUT /api/orders/:id/cancel',
      },
      payments: {
        createRazorpay: 'POST /api/payments/create-razorpay-order',
        verifyRazorpay: 'POST /api/payments/verify-razorpay-payment',
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats (Admin)',
        revenue: 'GET /api/dashboard/revenue/monthly (Admin)',
      },
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

/**
 * 404 Handler
 * Handle undefined routes
 */
app.use(notFound);

/**
 * Global Error Handler
 * Handle all errors
 */
app.use(errorHandler);

export default app;
