import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';
import crypto from 'crypto';
import sendEmail from '../utils/email.js';


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


// 1. FORGOT PASSWORD (Link Pampaadaniki)
export const forgotPassword = async (req, res) => {
  try {
    // 1. Get user based on POSTed email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found with this email' });
    }

    // 2. Generate the random reset token (Manam User Model lo raasina function)
    const resetToken = user.createPasswordResetToken();
    
    // Save without validation (password field require validation ni skip cheyadaniki)
    await user.save({ validateBeforeSave: false });

    // 3. Send it to user's email
    // Frontend URL structure: http://localhost:3000/reset-password/TOKEN
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `Forgot your password? Submit a PATCH request with your new password to: \n\n ${resetURL} \n\nIf you didn't forget your password, please ignore this email!`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your Password Reset Token (Valid for 10 min)',
        message,
      });

      res.status(200).json({
        success: true,
        message: 'Token sent to email!',
      });
    } catch (err) {
      // Email vellakapothe, Token ni delete cheseyali
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, message: 'Email could not be sent. Please try again later.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. RESET PASSWORD (Kotha Password Set Cheyadaniki)
export const resetPassword = async (req, res) => {
  try {
    // 1. URL lo vachina Token ni malli Hash chesi DB lo unna daani tho polchali
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // 2. Find user with that token AND check if token is NOT expired ($gt means greater than now)
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
    }

    // 3. Set new password
    user.password = req.body.password; // Mongoose will handle hashing via 'pre' save hook
    user.passwordResetToken = undefined; // Token ni remove cheseyali
    user.passwordResetExpires = undefined;
    
    await user.save();

    // 4. Log the user in, send JWT (Optional) or just success message
    res.status(200).json({
      success: true,
      message: 'Password changed successfully! You can now login.',
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};