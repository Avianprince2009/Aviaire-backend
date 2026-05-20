const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true, unique: true },
    otp: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otpSchema);




