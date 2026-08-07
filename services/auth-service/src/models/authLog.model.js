import mongoose from 'mongoose';

const authLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    event: { type: String, required: true },
    detail: { type: String, default: '' },
    ip: { type: String, default: '' },
    device: { type: String, default: '' },
    correlationId: { type: String, default: '' },
  },
  { timestamps: true }
);

authLogSchema.index({ userId: 1, createdAt: -1 });
authLogSchema.index({ event: 1 });

const AuthLog = mongoose.model('AuthLog', authLogSchema);
export default AuthLog;
