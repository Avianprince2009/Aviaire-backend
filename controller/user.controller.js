import UserModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import OtpModel from "../models/otp.model.js";
import nodemailer from "nodemailer";

const sendMail = async ({ to, subject, text }) => {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        MAIL_FROM,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
        throw new Error("Missing SMTP configuration in environment variables");
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject,
        text,
    });
};

// REGISTER (Name, Email, Password, Confirm Password)
const register = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !confirmPassword) {
        return res.status(400).json({ message: "Missing required fields: name, email, password, confirmPassword" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords must match" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    try {
        const saltRound = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, saltRound);

        const nameParts = trimmedName.split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || trimmedName;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

        const user = await UserModel.create({
            firstName,
            lastName,
            email: trimmedEmail,
            password: hashedPassword,
        });

        const token = jwt.sign(
            { id: user._id.toString(), email: user.email },
            process.env.APP_TOKEN,
            { expiresIn: "5h" }
        );

        return res.status(201).json({
            message: "User created successfully",
            data: { token },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "User already exists" });
        }

        console.log(error);
        return res.status(400).json({
            message: "User failed to create",
            error: error.message,
            details: error?.errors || error?.keyValue || null,
        });
    }
};

// GET ALL USERS
const getUsers = async (req, res) => {
    try {
        const users = await UserModel.find().select("-password");

        res.status(200).json({
            message: "Users fetched successfully",
            data: users,
        });
    } catch (error) {
        res.status(400).json({
            message: "cannot fetch users",
        });
    }
};

// GET ONE USER
const getUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await UserModel.findById(id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "user not found",
            });
        }

        res.status(200).json({
            message: "user fetched successfully",
            data: user,
        });
    } catch (error) {
        console.log(error);

        res.status(400).json({
            message: "error fetching user",
        });
    }
};

// DELETE USER
const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await UserModel.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({
                message: "user not found",
            });
        }

        res.status(200).json({
            message: "user deleted successfully",
            data: user,
        });
    } catch (error) {
        console.log(error);

        res.status(400).json({
            message: "error deleting user",
        });
    }
};

// EDIT USER
const editUser = async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, gender } = req.body;

    if (!firstName?.trim() && !lastName?.trim() && !email?.trim() && !gender) {
        return res.status(400).json({
            message: "At least one field is required to update",
        });
    }

    try {
        const updateData = {};

        if (firstName?.trim()) updateData.firstName = firstName.trim();
        if (lastName?.trim()) updateData.lastName = lastName.trim();
        if (email?.trim()) updateData.email = email.trim().toLowerCase();
        if (gender) updateData.gender = gender;

        const user = await UserModel.findByIdAndUpdate(id, updateData, {
            new: true,
        }).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "user not found",
            });
        }

        res.status(200).json({
            message: "user updated successfully",
            data: user,
        });
    } catch (error) {
        console.log(error);

        if (error.code === 11000) {
            return res.status(400).json({
                message: "Email already exists",
            });
        }

        res.status(400).json({
            message: "error updating user",
        });
    }
};

// LOGIN
const login = async (req, res) => {
    const bodyIsEmptyObject =
        req.body &&
        typeof req.body === "object" &&
        !Array.isArray(req.body) &&
        Object.keys(req.body).length === 0;

    if (bodyIsEmptyObject) {
        return res.status(400).json({
            message: "Request body is empty (expected JSON: { email, password })",
        });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            message: "email and password are required",
            receivedKeys: req.body ? Object.keys(req.body) : null,
        });
    }

    try {
        const user = await UserModel.findOne({
            email: email.trim().toLowerCase(),
        });

        if (!user) {
            return res.status(400).json({
                message: "wrong credentials",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "wrong credentials",
            });
        }

        const token = jwt.sign(
            { id: user._id.toString(), email: user.email },
            process.env.APP_TOKEN,
            { expiresIn: "5h" }
        );

        const adminEmail = "abubakriluqman7@gmail.com";
        const role = user?.email?.toLowerCase() === adminEmail.toLowerCase() ? "admin" : "user";

        return res.status(200).json({
            message: "login successful",
            token,
            role,
        });
    } catch (error) {
        console.log("LOGIN ERROR:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
    const id = req.user.id;
    const { oldPassword, newPassword } = req.body;

    try {
        const isuser = await UserModel.findById(id);
        if (!isuser) {
            return res.status(404).json({
                message: "user not found",
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, isuser.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "Error with password validation",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(newPassword, salt);

        await UserModel.findByIdAndUpdate(id, { password: hashedPass }, { new: true });

        return res.status(200).json({
            message: "Password updated successfully",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
};

// VERIFY USER (middleware)
const verifyUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "No token provided",
        });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return res.status(401).json({
            message: "Invalid token format",
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.APP_TOKEN);

        req.user = {
            id: decoded.id,
            email: decoded.email,
        };
        next();
    } catch (error) {
        console.log("VERIFY ERROR:", error.message);

        return res.status(401).json({
            message: "User unauthorized",
        });
    }
};

// POST /forgot-password
const forgotPassword = async (req, res) => {
    const { email } = req.body || {};

    if (!email?.trim()) {
        return res.status(400).json({ message: "email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await UserModel.findOne({ email: normalizedEmail });

    const generic = {
        message: "If an account exists for this email, you will receive a password reset code.",
    };

    if (!user) {
        return res.status(200).json(generic);
    }

    try {
        const otp = otpGenerator.generate(6, {
            digits: true,
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });

        await OtpModel.findOneAndUpdate(
            { email: normalizedEmail },
            { otp },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const expiresInMinutes = 10;
        const subject = "Password Reset Code";
        const text = `Your password reset code is: ${otp}\n\nIt will expire in ${expiresInMinutes} minutes.`;

        try {
            await sendMail({ to: normalizedEmail, subject, text });
        } catch (mailErr) {
            console.warn("[forgotPassword] Could not send email:", mailErr.message);
            console.log("[forgotPassword] OTP for", normalizedEmail, ":", otp);
        }

        return res.status(200).json(generic);
    } catch (err) {
        console.error("forgotPassword error:", err);
        return res.status(500).json({ message: "Failed to initiate password reset" });
    }
};

// POST /reset-password
const resetPassword = async (req, res) => {
    const { email, otp, newPassword, confirmPassword } = req.body || {};

    if (!email?.trim() || !otp || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "email, otp, newPassword, and confirmPassword are required" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords must match" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const otpDoc = await OtpModel.findOne({ email: normalizedEmail });
        if (!otpDoc) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const otpMatches = String(otpDoc.otp) === String(otp);
        if (!otpMatches) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const expiresInMs = 10 * 60 * 1000;
        const createdAtMs = new Date(otpDoc.createdAt).getTime();
        if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > expiresInMs) {
            await OtpModel.deleteOne({ email: normalizedEmail });
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const user = await UserModel.findOne({ email: normalizedEmail });
        if (!user) {
            await OtpModel.deleteOne({ email: normalizedEmail });
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(newPassword, salt);

        user.password = hashedPass;
        await user.save();

        await OtpModel.deleteOne({ email: normalizedEmail });

        return res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("resetPassword error:", err);
        return res.status(500).json({ message: "Failed to reset password" });
    }
};

export {
    register,
    getUsers,
    getUser,
    deleteUser,
    editUser,
    login,
    verifyUser,
    changePassword,
    forgotPassword,
    resetPassword,
};