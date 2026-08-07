import multer from 'multer';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true; // PNG
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true; // GIF
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true; // WEBP
  return false;
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new ApiError(400, 'INVALID_IMAGE_TYPE', 'Only JPEG, PNG, WEBP or GIF images are allowed'), false);
    }
    return cb(null, true);
  },
});

export function validateImageBuffers(req, _res, next) {
  const fields = req.files || {};
  for (const field of ['profilePic', 'coverPic']) {
    const file = fields[field]?.[0];
    if (file) {
      if (file.size > config.maxImageBytes) {
        return next(new ApiError(413, 'IMAGE_TOO_LARGE', `Image exceeds the ${config.maxImageBytes / (1024 * 1024)} MB limit`));
      }
      if (!sniffImage(file.buffer)) {
        return next(new ApiError(400, 'INVALID_IMAGE_CONTENT', 'Uploaded file is not a valid image'));
      }
    }
  }
  return next();
}
