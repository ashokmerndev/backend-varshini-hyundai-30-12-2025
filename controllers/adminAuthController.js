// import { asyncHandler, AppError } from '../utils/errorHandler.js';
// import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
// import { sendSuccess } from '../utils/response.js';
// import Admin from '../models/Admin.js';

// /**
//  * @desc    Admin Login
//  * @route   POST /api/admin/auth/login
//  * @access  Public
//  */
// export const adminLogin = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;

//   // Validate input
//   if (!email || !password) {
//     throw new AppError('Please provide email and password', 400);
//   }

//   // Find admin with password field
//   const admin = await Admin.findOne({ email }).select('+password');

//   if (!admin) {
//     throw new AppError('Invalid credentials', 401);
//   }

//   // Check if admin is active
//   if (!admin.isActive) {
//     throw new AppError('Account is deactivated', 401);
//   }

//   // Verify password
//   const isPasswordValid = await admin.comparePassword(password);

//   if (!isPasswordValid) {
//     throw new AppError('Invalid credentials', 401);
//   }

//   // Generate tokens
//   const { accessToken, refreshToken } = generateTokenPair({
//     id: admin._id,
//     email: admin.email,
//     role: admin.role,
//   });

//   // Save refresh token to database
//   admin.refreshToken = refreshToken;
//   admin.lastLogin = new Date();
//   await admin.save();

//   // Send response
//   sendSuccess(res, 200, 'Login successful', {
//     admin: {
//       id: admin._id,
//       name: admin.name,
//       email: admin.email,
//       role: admin.role,
//     },
//     accessToken,
//     refreshToken,
//   });
// });

// /**
//  * @desc    Get Admin Profile
//  * @route   GET /api/admin/auth/profile
//  * @access  Private (Admin)
//  */
// export const getAdminProfile = asyncHandler(async (req, res) => {
//   const admin = await Admin.findById(req.user._id);

//   sendSuccess(res, 200, 'Profile retrieved successfully', {
//     admin,
//   });
// });

// /**
//  * @desc    Update Admin Profile
//  * @route   PUT /api/admin/auth/profile
//  * @access  Private (Admin)
//  */
// export const updateAdminProfile = asyncHandler(async (req, res) => {
//   const { name, email } = req.body;

//   const admin = await Admin.findById(req.user._id);

//   if (!admin) {
//     throw new AppError('Admin not found', 404);
//   }

//   // Update fields
//   if (name) admin.name = name;
//   if (email) admin.email = email;

//   await admin.save();

//   sendSuccess(res, 200, 'Profile updated successfully', {
//     admin,
//   });
// });

// /**
//  * @desc    Change Admin Password
//  * @route   PUT /api/admin/auth/change-password
//  * @access  Private (Admin)
//  */
// export const changeAdminPassword = asyncHandler(async (req, res) => {
//   const { currentPassword, newPassword } = req.body;

//   if (!currentPassword || !newPassword) {
//     throw new AppError('Please provide current and new password', 400);
//   }

//   const admin = await Admin.findById(req.user._id).select('+password');

//   if (!admin) {
//     throw new AppError('Admin not found', 404);
//   }

//   // Verify current password
//   const isPasswordValid = await admin.comparePassword(currentPassword);

//   if (!isPasswordValid) {
//     throw new AppError('Current password is incorrect', 401);
//   }

//   // Update password
//   admin.password = newPassword;
//   await admin.save();

//   sendSuccess(res, 200, 'Password changed successfully');
// });

// /**
//  * @desc    Refresh Access Token
//  * @route   POST /api/admin/auth/refresh-token
//  * @access  Public
//  */
// export const refreshAdminToken = asyncHandler(async (req, res) => {
//   const { refreshToken } = req.body;

//   if (!refreshToken) {
//     throw new AppError('Refresh token is required', 400);
//   }

//   try {
//     // Verify refresh token
//     const decoded = verifyRefreshToken(refreshToken);

//     // Find admin and verify refresh token
//     const admin = await Admin.findById(decoded.id).select('+refreshToken');

//     if (!admin || admin.refreshToken !== refreshToken) {
//       throw new AppError('Invalid refresh token', 401);
//     }

//     // Generate new access token
//     const { accessToken, refreshToken: newRefreshToken } = generateTokenPair({
//       id: admin._id,
//       email: admin.email,
//       role: admin.role,
//     });

//     // Update refresh token in database
//     admin.refreshToken = newRefreshToken;
//     await admin.save();

//     sendSuccess(res, 200, 'Token refreshed successfully', {
//       accessToken,
//       refreshToken: newRefreshToken,
//     });
//   } catch (error) {
//     throw new AppError('Invalid or expired refresh token', 401);
//   }
// });

// /**
//  * @desc    Admin Logout
//  * @route   POST /api/admin/auth/logout
//  * @access  Private (Admin)
//  */
// export const adminLogout = asyncHandler(async (req, res) => {
//   const admin = await Admin.findById(req.user._id);

//   if (admin) {
//     admin.refreshToken = null;
//     await admin.save();
//   }

//   sendSuccess(res, 200, 'Logout successful');
// });








import { asyncHandler, AppError } from '../utils/errorHandler.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccess } from '../utils/response.js';
import Admin from '../models/Admin.js';
// Cloudinary config file unte import chesukondi, lekapothe comment lo unna logic chudandi
import {cloudinary} from '../config/cloudinary.js'; 

/**
 * @desc    Admin Login
 * @route   POST /api/admin/auth/login
 * @access  Public
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  const admin = await Admin.findOne({ email }).select('+password');

  if (!admin) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!admin.isActive) {
    throw new AppError('Account is deactivated', 401);
  }

  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  const { accessToken, refreshToken } = generateTokenPair({
    id: admin._id,
    email: admin.email,
    role: admin.role,
  });

  admin.refreshToken = refreshToken;
  admin.lastLogin = new Date();
  await admin.save();

  sendSuccess(res, 200, 'Login successful', {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatar: admin.avatar,
      phone: admin.phone,
      bio: admin.bio,
      notifications: admin.notifications,
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

  if (!admin) {
    throw new AppError('Admin not found', 404);
  }

  sendSuccess(res, 200, 'Profile retrieved successfully', {
    data: admin, // Note: standardized to 'data' key or match your frontend expectation
  });
});

/**
 * @desc    Update Admin Profile (Cloudinary Integrated)
 * @route   PUT /api/admin/auth/profile
 * @access  Private (Admin)
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  // 1. Text Fields Extract Cheyandi
  const { name, email, phone, bio, notifications } = req.body;

  const admin = await Admin.findById(req.user._id);

  if (!admin) {
    throw new AppError('Admin not found', 404);
  }

  // 2. Image Upload Handling (Cloudinary)
  // `upload.single` middleware already upload chesesindi. 
  // URL `req.file.path` lo untundi.
  if (req.file) {
    admin.avatar = req.file.path; // Direct Cloudinary URL saves to DB
  }

  // 3. Update Text Fields
  if (name) admin.name = name;
  if (email) admin.email = email;
  if (phone) admin.phone = phone;
  if (bio) admin.bio = bio;

  // 4. Handle Notifications (Parsing JSON string from FormData)
  if (notifications) {
    let parsedNotifications = notifications;
    // FormData nundi object string laga vasthe parse cheyali
    if (typeof notifications === 'string') {
      try {
        parsedNotifications = JSON.parse(notifications);
      } catch (error) {
        // Parsing fail aithe existing notifications ni em cheyoddu or default pettandi
        console.error("Notification parsing failed:", error); 
      }
    }
    
    // Merge existing with new
    admin.notifications = {
      ...admin.notifications,
      ...parsedNotifications
    };
  }

  // 5. Save and Return
  await admin.save();

  // Return updated data
  sendSuccess(res, 200, 'Profile updated successfully', {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatar: admin.avatar, // Updated URL
      phone: admin.phone,
      bio: admin.bio,
      notifications: admin.notifications,
    },
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

  const isPasswordValid = await admin.comparePassword(currentPassword);

  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  admin.password = newPassword;
  
  // Optional: Force logout on other devices by changing refresh token logic
  // admin.refreshToken = null; 
  
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
    const decoded = verifyRefreshToken(refreshToken);

    const admin = await Admin.findById(decoded.id).select('+refreshToken');

    if (!admin || admin.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair({
      id: admin._id,
      email: admin.email,
      role: admin.role,
    });

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
 * @desc    Admin Logout (Current Session)
 * @route   POST /api/admin/auth/logout
 * @access  Private (Admin)
 */
export const adminLogout = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);

  if (admin) {
    // In a single-token system, this logs out the user everywhere eventually
    admin.refreshToken = null;
    await admin.save();
  }

  // Clear client-side cookie if you are using cookies
  // res.clearCookie('accessToken');

  sendSuccess(res, 200, 'Logout successful');
});

/**
 * @desc    Logout from All Devices
 * @route   POST /api/admin/auth/logout-all
 * @access  Private (Admin)
 */
export const logoutAllSessions = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.user._id);
  
    if (admin) {
      // Invaliding the refresh token ensures no other device can refresh their session
      admin.refreshToken = null; 
      
      // NOTE: If you store an ARRAY of tokens in DB for multi-device support,
      // you would do: admin.refreshTokens = [];
      
      await admin.save();
    }
  
    sendSuccess(res, 200, 'Logged out from all devices successfully');
});