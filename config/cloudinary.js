import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 1. Configure Cloudinary
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * 2. Configure Storage
 * Logic: 'avatar' field ayithe 'admin-profiles' folder lo,
 * lekapothe 'products' folder lo save chestundi.
 */
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = 'hyundai-spares/others';

    // Check fieldname to decide folder
    if (file.fieldname === 'avatar') {
      folderName = 'hyundai-spares/admin-profiles';
    } else if (file.fieldname === 'productImage') {
      folderName = 'hyundai-spares/products';
    }

    return {
      folder: folderName,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 800, height: 800, crop: 'limit' }], // Resize to save bandwidth
    };
  },
});

/**
 * 3. Multer Upload Middleware
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
});

/**
 * 4. Helper to Delete Image
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
    console.log(`Image deleted from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error(`Error deleting image: ${error.message}`);
  }
};

// IMPORTANT: export 'upload' as default to fix the import error in routes
export { cloudinary, upload, deleteFromCloudinary };