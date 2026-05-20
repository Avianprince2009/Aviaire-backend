import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, index: { unique: true } },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'users' }
)

export default mongoose.models.User || mongoose.model('User', userSchema)
