import mongoose from "mongoose";

const UserSchema = mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, enum: ["male", "female", null], default: null },
    isVerified: { type: Boolean, default: false },
    profileImage: {
        public_id: { type: String },
        secure_url: { type: String }
    }
}, { timestamps: true, strict: true });

const UserModel = mongoose.model("user", UserSchema);

export default UserModel;