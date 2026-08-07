import { profileService } from '../services/profileService.js';
import { validateProfileUpdate } from '../validators/profile.validator.js';

function pickedFields(req) {
  const files = req.files || {};
  return {
    profilePic: files.profilePic?.[0] || null,
    coverPic: files.coverPic?.[0] || null,
  };
}

export const profileController = {
  async getMe(req, res, next) {
    try {
      const user = await profileService.getByUserId(req.auth.userId);
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const user = await profileService.getByUserId(req.params.id);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const fields = validateProfileUpdate(req.body);
      const files = pickedFields(req);
      const user = await profileService.update({ userId: req.auth.userId, ...fields, ...files });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
};
