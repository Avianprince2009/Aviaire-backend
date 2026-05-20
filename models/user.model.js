const mongoose = require("mongoose")

const UserSchema = mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Allow null so register (which doesn't collect gender) doesn't throw
    gender: { type: String, enum: ["male", "female", null], default: null },
    isVerified: { type: Boolean, default: false },
    profileImage: {
        public_id: { type: String },
        secure_url: { type: String }
    }

// FIXED: was strict:"throw" which crashed whenever gender:null was passed
}, { timestamps: true, strict: true })


// FIXED: was misleadingly named OtpModel
const UserModel = mongoose.model("user", UserSchema)

module.exports = UserModel
