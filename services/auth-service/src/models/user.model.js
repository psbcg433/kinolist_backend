import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    status: { type: String, enum: ['active', 'disabled', 'deleted'], default: 'active' },
    twoFAEnabled: { type: Boolean, default: false },
    twoFASecretEncrypted: { type: String, default: '' },
    pendingTwoFASecretEncrypted: { type: String, default: '' },
    pendingTwoFASecretExpiresAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
export default User;
