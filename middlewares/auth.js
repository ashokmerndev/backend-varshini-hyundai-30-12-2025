import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

/**
 * Protect Routes - Verify JWT Token
 * Middleware to authenticate users using JWT
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 2. Check if token exists
  if (!token) {
    return next(new AppError('Not authorized. Please login to access this resource.', 401));
  }

  // 3. Verify Token (Isolated Try-Catch)
  // We check this separately so we can distinguish between "Bad Token" and "User Not Found"
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    return next(new AppError('Not authorized. Invalid token.', 401));
  }

  // 4. Check User Type and Database (No Try-Catch here, let asyncHandler catch DB errors)
  if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      return next(new AppError('Admin not found', 401));
    }

    if (!admin.isActive) {
      return next(new AppError('Admin account is deactivated', 401));
    }

    req.user = admin;
    req.userType = 'admin';
  } else {
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    if (!user.isActive) {
      return next(new AppError('User account is deactivated', 401));
    }

    req.user = user;
    req.userType = 'customer';
  }

  next();
});

/**
 * Admin Only Middleware
 * Restrict access to admin users only
 */
export const adminOnly = asyncHandler(async (req, res, next) => {
  if (!req.user || req.userType !== 'admin') {
    return next(new AppError('Access denied. Admin privileges required.', 403));
  }

  next();
});

/**
 * Customer Only Middleware
 * Restrict access to customer users only
 */
export const customerOnly = asyncHandler(async (req, res, next) => {
  if (!req.user || req.userType !== 'customer') {
    return next(new AppError('Access denied. Customer account required.', 403));
  }

  next();
});

/**
 * Optional Authentication
 * Attaches user to request if token is valid, but doesn't require it
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);

      if (decoded.role === 'admin' || decoded.role === 'superadmin') {
        const admin = await Admin.findById(decoded.id).select('-password');
        if (admin && admin.isActive) {
          req.user = admin;
          req.userType = 'admin';
        }
      } else {
        const user = await User.findById(decoded.id).select('-password');
        if (user && user.isActive) {
          req.user = user;
          req.userType = 'customer';
        }
      }
    } catch (error) {
      // Token is invalid/expired, but we don't crash.
      // We just continue as a "Guest" (req.user remains undefined)
    }
  }

  next();
});