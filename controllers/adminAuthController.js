import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccess } from '../utils/response.js';
import Admin from '../models/Admin.js';

/**
 * @desc    Admin Login
 * @route   POST /api/admin/auth/login
 * @access  Public
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // Find admin with password field
  const admin = await Admin.findOne({ email }).select('+password');

  if (!admin) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check if admin is active
  if (!admin.isActive) {
    throw new AppError('Account is deactivated', 401);
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair({
    id: admin._id,
    email: admin.email,
    role: admin.role,
  });

  // Save refresh token to database
  admin.refreshToken = refreshToken;
  admin.lastLogin = new Date();
  await admin.save();

  // Send response
  sendSuccess(res, 200, 'Login successful', {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    Get Admin Profile
 * @route   GET /api/admin/auth/profile
 * @access  Private (Admin)
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);

  sendSuccess(res, 200, 'Profile retrieved successfully', {
    admin,
  });
});

/**
 * @desc    Update Admin Profile
 * @route   PUT /api/admin/auth/profile
 * @access  Private (Admin)
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  const admin = await Admin.findById(req.user._id);

  if (!admin) {
    throw new AppError('Admin not found', 404);
  }

  // Update fields
  if (name) admin.name = name;
  if (email) admin.email = email;

  await admin.save();

  sendSuccess(res, 200, 'Profile updated successfully', {
    admin,
  });
});

/**
 * @desc    Change Admin Password
 * @route   PUT /api/admin/auth/change-password
 * @access  Private (Admin)
 */
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }

  const admin = await Admin.findById(req.user._id).select('+password');

  if (!admin) {
    throw new AppError('Admin not found', 404);
  }

  // Verify current password
  const isPasswordValid = await admin.comparePassword(currentPassword);

  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Update password
  admin.password = newPassword;
  await admin.save();

  sendSuccess(res, 200, 'Password changed successfully');
});

/**
 * @desc    Refresh Access Token
 * @route   POST /api/admin/auth/refresh-token
 * @access  Public
 */
export const refreshAdminToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find admin and verify refresh token
    const admin = await Admin.findById(decoded.id).select('+refreshToken');

    if (!admin || admin.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Generate new access token
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair({
      id: admin._id,
      email: admin.email,
      role: admin.role,
    });

    // Update refresh token in database
    admin.refreshToken = newRefreshToken;
    await admin.save();

    sendSuccess(res, 200, 'Token refreshed successfully', {
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
});

/**
 * @desc    Admin Logout
 * @route   POST /api/admin/auth/logout
 * @access  Private (Admin)
 */
export const adminLogout = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);

  if (admin) {
    admin.refreshToken = null;
    await admin.save();
  }

  sendSuccess(res, 200, 'Logout successful');
});
