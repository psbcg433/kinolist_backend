import mongoose from 'mongoose';

const pendingEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
    occurredAt: { type: String, required: true },
    producer: { type: String, required: true },
    correlationId: { type: String, default: null },
    causationId: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    status: { type: String, enum: ['active', 'disabled', 'deleted'], default: 'active' },
    twoFAEnabled: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 1 },
    // Embedded outbox: the user mutation and its domain event are persisted in
    // the same Mongo document update, which works even on standalone Mongo.
    pendingEvents: { type: [pendingEventSchema], default: [] },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;
