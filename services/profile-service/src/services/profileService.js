import { profileRepository } from '../repositories/profileRepository.js';
import { cloudinaryProvider } from '../providers/cloudinaryProvider.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function profileDTO(profile) {
  if (!profile) return null;
  return {
    id: profile.userId,
    name: profile.name || '',
    bio: profile.bio || '',
    profilePic: profile.profilePicUrl || '',
    coverPic: profile.coverPicUrl || '',
  };
}

export const profileService = {
  async createFromRegistration({ userId, name }) {
    const fields = {};
    if (name && typeof name === 'string') fields.name = name.trim().slice(0, 100);
    const profile = await profileRepository.createIfAbsent(userId, fields);
    logger.info('profile_created_from_event', { userId });
    return profileDTO(profile);
  },

  async getByUserId(userId) {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
      throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }
    return profileDTO(profile);
  },

  async update({ userId, name, bio, profilePicFile, coverPicFile }) {
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim().slice(0, 100);
    if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 500);

    const uploadedAssets = [];
    try {
      const existing = await profileRepository.findByUserId(userId);

      if (profilePicFile) {
        const asset = await cloudinaryProvider.upload(profilePicFile.buffer, 'kinolist/profile_pics');
        uploadedAssets.push({ publicId: asset.publicId });
        updates.profilePicUrl = asset.secureUrl;
        updates.profilePicPublicId = asset.publicId;
      }
      if (coverPicFile) {
        const asset = await cloudinaryProvider.upload(coverPicFile.buffer, 'kinolist/cover_pics');
        uploadedAssets.push({ publicId: asset.publicId });
        updates.coverPicUrl = asset.secureUrl;
        updates.coverPicPublicId = asset.publicId;
      }

      const profile = await profileRepository.update(userId, updates);
      if (!profile) {
        throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
      }

      // Retire replaced assets only after the new state is durable.
      if (profilePicFile && existing?.profilePicPublicId) {
        await cloudinaryProvider.destroy(existing.profilePicPublicId);
      }
      if (coverPicFile && existing?.coverPicPublicId) {
        await cloudinaryProvider.destroy(existing.coverPicPublicId);
      }

      return profileDTO(profile);
    } catch (err) {
      // Compensate: remove any newly uploaded assets if the DB update failed.
      for (const asset of uploadedAssets) {
        await cloudinaryProvider.destroy(asset.publicId);
      }
      throw err;
    }
  },

  async deleteForUser(userId) {
    const profile = await profileRepository.deleteByUserId(userId);
    if (profile) {
      await cloudinaryProvider.destroy(profile.profilePicPublicId);
      await cloudinaryProvider.destroy(profile.coverPicPublicId);
    }
    logger.info('profile_deleted_from_event', { userId });
    return true;
  },
};
