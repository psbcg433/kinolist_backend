import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export const cloudinaryProvider = {
  async upload(buffer, folder) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(buffer);
    }).catch((err) => {
      logger.error('cloudinary_upload_failed', { folder, message: err.message });
      throw new ApiError(502, 'IMAGE_UPLOAD_FAILED', 'Image upload failed. Please try again.');
    });
  },

  async destroy(publicId) {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      logger.warn('cloudinary_destroy_failed', { publicId, message: err.message });
    }
  },
};
