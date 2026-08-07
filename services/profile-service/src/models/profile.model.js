import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '', trim: true, maxlength: 100 },
    bio: { type: String, default: '', maxlength: 500 },
    profilePicUrl: { type: String, default: '' },
    profilePicPublicId: { type: String, default: '' },
    coverPicUrl: { type: String, default: '' },
    coverPicPublicId: { type: String, default: '' },
  },
  { timestamps: true }
);

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
