import { profileService } from '../services/profileService.js';
import { validateProfileUpdate } from '../validators/profile.validator.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

export function pickedFields(req) {
  const files = req.files || {};
  return {
    profilePicFile: files.profilePic?.[0] || null,
    coverPicFile: files.coverPic?.[0] || null,
  };
}

export const profileController = {
  async getMe(req, res, next) {
    try {
      const user = await profileService.getByUserId(req.auth.userId);
      sendSuccess(req, res, { user });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      if (String(req.params.id) !== String(req.auth.userId)) {
        throw new ApiError(403, 'FORBIDDEN', 'You cannot view another user\u2019s private profile');
      }
      const user = await profileService.getByUserId(req.params.id);
      sendSuccess(req, res, { user });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const fields = validateProfileUpdate(req.body);
      const files = pickedFields(req);
      const user = await profileService.update({ userId: req.auth.userId, ...fields, ...files });
      sendSuccess(req, res, { user });
    } catch (err) {
      next(err);
    }
  },
};
