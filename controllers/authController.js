import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';

/**
 * @desc    User Registration
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone,
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  sendSuccess(res, 201, 'Registration successful', {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    User Login
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  // Find user with password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401);
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  // Save refresh token
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save();

  sendSuccess(res, 200, 'Login successful', {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    Get User Profile
 * @route   GET /api/auth/profile
 * @access  Private (Customer)
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  sendSuccess(res, 200, 'Profile retrieved successfully', {
    user,
  });
});

/**
 * @desc    Update User Profile
 * @route   PUT /api/auth/profile
 * @access  Private (Customer)
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update fields
  if (name) user.name = name;
  if (phone) user.phone = phone;

  await user.save();

  sendSuccess(res, 200, 'Profile updated successfully', {
    user,
  });
});

/**
 * @desc    Change User Password
 * @route   PUT /api/auth/change-password
 * @access  Private (Customer)
 */
export const changeUserPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);

  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  sendSuccess(res, 200, 'Password changed successfully');
});

/**
 * @desc    Add User Address
 * @route   POST /api/auth/address
 * @access  Private (Customer)
 */
export const addAddress = asyncHandler(async (req, res) => {
  const { addressType, street, city, state, pincode, isDefault } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // If this is set as default, unset other defaults
  if (isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  // Add new address
  user.addresses.push({
    addressType,
    street,
    city,
    state,
    pincode,
    isDefault: isDefault || user.addresses.length === 0, // First address is default
  });

  await user.save();

  sendSuccess(res, 201, 'Address added successfully', {
    addresses: user.addresses,
  });
});

/**
 * @desc    Update User Address
 * @route   PUT /api/auth/address/:addressId
 * @access  Private (Customer)
 */
export const updateAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const { addressType, street, city, state, pincode, isDefault } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    throw new AppError('Address not found', 404);
  }

  // Update address fields
  if (addressType) address.addressType = addressType;
  if (street) address.street = street;
  if (city) address.city = city;
  if (state) address.state = state;
  if (pincode) address.pincode = pincode;

  // Handle default address
  if (isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
    address.isDefault = true;
  }

  await user.save();

  sendSuccess(res, 200, 'Address updated successfully', {
    addresses: user.addresses,
  });
});

/**
 * @desc    Delete User Address
 * @route   DELETE /api/auth/address/:addressId
 * @access  Private (Customer)
 */
export const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    throw new AppError('Address not found', 404);
  }

  // Remove address
  address.deleteOne();

  // If deleted address was default, make first address default
  if (user.addresses.length > 0 && !user.addresses.some((addr) => addr.isDefault)) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  sendSuccess(res, 200, 'Address deleted successfully', {
    addresses: user.addresses,
  });
});

/**
 * @desc    Refresh Access Token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
export const refreshUserToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and verify refresh token
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    sendSuccess(res, 200, 'Token refreshed successfully', {
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
});

/**
 * @desc    User Logout
 * @route   POST /api/auth/logout
 * @access  Private (Customer)
 */
export const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  sendSuccess(res, 200, 'Logout successful');
});
