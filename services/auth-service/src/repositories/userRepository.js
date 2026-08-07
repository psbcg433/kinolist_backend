import User from '../models/user.model.js';

export const userRepository = {
  async findByEmail(email) {
    return User.findOne({ email });
  },

  async findById(id) {
    return User.findById(id);
  },

  async create({ email, passwordHash, role = 'USER' }) {
    return User.create({ email, passwordHash, role });
  },

  async incrementTokenVersion(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );
    return user;
  },

  async markDeleted(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { status: 'deleted' }, $inc: { tokenVersion: 1 } },
      { new: true }
    );
    return user;
  },
};
