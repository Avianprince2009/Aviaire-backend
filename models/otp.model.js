import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true, unique: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index so expired OTPs are automatically removed.
// (expireAfterSeconds: 0 means expire exactly at expiresAt)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Reuse model to avoid OverwriteModelError in dev/hot-reload.
const OtpModel = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

export default OtpModel;


