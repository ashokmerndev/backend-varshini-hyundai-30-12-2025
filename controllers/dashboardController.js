import { asyncHandler } from '../utils/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';

/**
 * @desc    Get Dashboard Stats
 * @route   GET /api/dashboard/stats
 * @access  Private (Admin)
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get total orders
  const totalOrders = await Order.countDocuments();

  // Get total revenue (completed payments)
  const revenueData = await Payment.aggregate([
    {
      $match: { paymentStatus: 'Completed' },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
      },
    },
  ]);

  const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

  // Get total customers
  const totalCustomers = await User.countDocuments({ role: 'customer' });

  // Get orders by status
  const ordersByStatus = await Order.aggregate([
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get pending orders count
  const pendingOrders = await Order.countDocuments({
    orderStatus: { $in: ['Placed', 'Confirmed', 'Packed'] },
  });

  // Get low stock products count
  const lowStockCount = await Product.countDocuments({
    stockStatus: { $in: ['Low Stock', 'Out of Stock'] },
    isActive: true,
  });

  // Get today's orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = await Order.countDocuments({
    createdAt: { $gte: today },
  });

  // Get today's revenue
  const todayRevenueData = await Payment.aggregate([
    {
      $match: {
        paymentStatus: 'Completed',
        paidAt: { $gte: today },
      },
    },
    {
      $group: {
        _id: null,
        todayRevenue: { $sum: '$amount' },
      },
    },
  ]);

  const todayRevenue = todayRevenueData.length > 0 ? todayRevenueData[0].todayRevenue : 0;

  sendSuccess(res, 200, 'Dashboard stats retrieved successfully', {
    stats: {
      totalOrders,
      totalRevenue,
      totalCustomers,
      pendingOrders,
      lowStockCount,
      todayOrders,
      todayRevenue,
      ordersByStatus,
    },
  });
});

/**
 * @desc    Get Monthly Revenue
 * @route   GET /api/dashboard/revenue/monthly
 * @access  Private (Admin)
 */
export const getMonthlyRevenue = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const monthlyRevenue = await Payment.aggregate([
    {
      $match: {
        paymentStatus: 'Completed',
        paidAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$paidAt' },
        revenue: { $sum: '$amount' },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Fill in missing months with 0
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const monthData = monthlyRevenue.find((m) => m._id === i + 1);
    return {
      month: i + 1,
      monthName: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
      revenue: monthData ? monthData.revenue : 0,
      orders: monthData ? monthData.orders : 0,
    };
  });

  sendSuccess(res, 200, 'Monthly revenue retrieved successfully', {
    year,
    data: allMonths,
  });
});

/**
 * @desc    Get Daily Revenue (Last 30 Days)
 * @route   GET /api/dashboard/revenue/daily
 * @access  Private (Admin)
 */
export const getDailyRevenue = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyRevenue = await Payment.aggregate([
    {
      $match: {
        paymentStatus: 'Completed',
        paidAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$paidAt' },
        },
        revenue: { $sum: '$amount' },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  sendSuccess(res, 200, 'Daily revenue retrieved successfully', {
    data: dailyRevenue,
  });
});

/**
 * @desc    Get Recent Orders
 * @route   GET /api/dashboard/orders/recent
 * @access  Private (Admin)
 */
export const getRecentOrders = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const recentOrders = await Order.find()
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  sendSuccess(res, 200, 'Recent orders retrieved successfully', {
    orders: recentOrders,
  });
});

/**
 * @desc    Get Low Stock Products
 * @route   GET /api/dashboard/products/low-stock
 * @access  Private (Admin)
 */
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const lowStockProducts = await Product.find({
    stockStatus: { $in: ['Low Stock', 'Out of Stock'] },
    isActive: true,
  })
    .sort({ stock: 1 })
    .limit(20);

  sendSuccess(res, 200, 'Low stock products retrieved successfully', {
    products: lowStockProducts,
    count: lowStockProducts.length,
  });
});

/**
 * @desc    Get Top Selling Products
 * @route   GET /api/dashboard/products/top-selling
 * @access  Private (Admin)
 */
export const getTopSellingProducts = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const topProducts = await Product.find({ isActive: true })
    .sort({ totalSales: -1 })
    .limit(Number(limit));

  sendSuccess(res, 200, 'Top selling products retrieved successfully', {
    products: topProducts,
  });
});

/**
 * @desc    Get Sales by Category
 * @route   GET /api/dashboard/sales/by-category
 * @access  Private (Admin)
 */
export const getSalesByCategory = asyncHandler(async (req, res) => {
  const salesByCategory = await Order.aggregate([
    {
      $match: {
        orderStatus: { $ne: 'Cancelled' },
      },
    },
    {
      $unwind: '$items',
    },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productDetails',
      },
    },
    {
      $unwind: '$productDetails',
    },
    {
      $group: {
        _id: '$productDetails.category',
        totalSales: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.subtotal' },
      },
    },
    {
      $sort: { totalRevenue: -1 },
    },
  ]);

  sendSuccess(res, 200, 'Sales by category retrieved successfully', {
    data: salesByCategory,
  });
});

/**
 * @desc    Get Customer Growth
 * @route   GET /api/dashboard/customers/growth
 * @access  Private (Admin)
 */
export const getCustomerGrowth = asyncHandler(async (req, res) => {
  const { months = 6 } = req.query;

  const monthsAgo = new Date();
  monthsAgo.setMonth(monthsAgo.getMonth() - Number(months));

  const customerGrowth = await User.aggregate([
    {
      $match: {
        role: 'customer',
        createdAt: { $gte: monthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        newCustomers: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);

  sendSuccess(res, 200, 'Customer growth retrieved successfully', {
    data: customerGrowth,
  });
});

/**
 * @desc    Get Payment Method Statistics
 * @route   GET /api/dashboard/payments/methods
 * @access  Private (Admin)
 */
export const getPaymentMethodStats = asyncHandler(async (req, res) => {
  const paymentStats = await Payment.aggregate([
    {
      $match: {
        paymentStatus: 'Completed',
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  sendSuccess(res, 200, 'Payment method statistics retrieved successfully', {
    data: paymentStats,
  });
});
