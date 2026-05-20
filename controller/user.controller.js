const UserModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

// create user (legacy / non-register route)
const addUserToDB = async (req, res) => {
    const { firstName, lastName, email, password, gender } = req.body


    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
            message: "Missing required fields: firstName, lastName, email, password"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: "Password must be at least 6 characters"
        });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    try {
        const saltRound = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, saltRound)

        const user = await UserModel.create({
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: trimmedEmail,
            password: hashedPassword,
            ...(gender === "male" || gender === "female" ? { gender } : {}),
        });


        const token = jwt.sign(
            { id: user._id },
            process.env.APP_TOKEN,
            { expiresIn: "5h" }
        )

        res.status(201).send({
            message: "User created successfully",
            data: {
                firstName,
                lastName,
                email,
                gender,
                token
            }
        })

    } catch (error) {
        console.log(error);

        if (error.code == "11000") {
            return res.status(409).send({
                message: "User already exists",
                field: error?.keyValue?.email ? "email" : undefined,
            })
        }

        res.status(400).send({
            message: "user failed to create",
        })
    }
}

// GET ALL USERS
const getUsers = async (req, res) => {
    try {
        const users = await UserModel.find().select("-password")

        res.status(200).send({
            message: "Users fetched successfully",
            data: users
        })

    } catch (error) {
        res.status(400).send({
            message: "cannot fetch users"
        })
    }
}

// GET ONE USER
const getUser = async (req, res) => {
    const { id } = req.params

    try {
        const user = await UserModel.findById(id).select("-password")

        if (!user) {
            return res.status(404).send({
                message: "user not found"
            })
        }

        res.status(200).send({
            message: "user fetched successfully",
            data: user
        })

    } catch (error) {
        console.log(error);

        res.status(400).send({
            message: "error fetching user"
        })
    }
}

// DELETE USER
const deleteUser = async (req, res) => {
    const { id } = req.params

    try {
        const user = await UserModel.findByIdAndDelete(id)

        if (!user) {
            return res.status(404).send({
                message: "user not found"
            })
        }

        res.status(200).send({
            message: "user deleted successfully",
            data: user
        })

    } catch (error) {
        console.log(error)

        res.status(400).send({
            message: "error deleting user"
        })
    }
}

// EDIT USER
const editUser = async (req, res) => {
    const { id } = req.params
    const { firstName, lastName, email, gender } = req.body

    if (!firstName?.trim() && !lastName?.trim() && !email?.trim() && !gender) {
        return res.status(400).json({
            message: "At least one field is required to update"
        })
    }

    try {
        const updateData = {}

        if (firstName?.trim()) updateData.firstName = firstName.trim()
        if (lastName?.trim()) updateData.lastName = lastName.trim()
        if (email?.trim()) updateData.email = email.trim().toLowerCase()
        if (gender) updateData.gender = gender

        const user = await UserModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).select("-password")

        if (!user) {
            return res.status(404).send({
                message: "user not found"
            })
        }

        res.status(200).send({
            message: "user updated successfully",
            data: user
        })

    } catch (error) {
        console.log(error)

        if (error.code === "11000") {
            return res.status(400).send({
                message: "Email already exists"
            })
        }

        res.status(400).send({
            message: "error updating user"
        })
    }
}

// LOGIN
const login = async (req, res) => {
    const bodyIsEmptyObject =
        req.body &&
        typeof req.body === 'object' &&
        !Array.isArray(req.body) &&
        Object.keys(req.body).length === 0;

    if (bodyIsEmptyObject) {
        return res.status(400).send({
            message: 'Request body is empty (expected JSON: { email, password })'
        });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).send({
            message: "email and password are required",
            receivedKeys: req.body ? Object.keys(req.body) : null
        });
    }

    try {
        const user = await UserModel.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(400).send({
                message: "wrong credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).send({
                message: "wrong credentials"
            });
        }

        const token = jwt.sign(
            { id: user._id.toString(), email: user.email },
            process.env.APP_TOKEN,
            { expiresIn: "5h" }
        );

        const adminEmail = "abubakriluqman7@gmail.com"
        const role = user?.email?.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'user'

        return res.status(200).send({
            message: "login successful",
            token,
            role
        });

    } catch (error) {
        console.log("LOGIN ERROR:", error);
        return res.status(500).send({
            message: "Server error",
            error: error.message
        });
    }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
    // FIXED: was `const id = req.user` (whole object), should be req.user.id
    const id = req.user.id
    const { oldPassword, newPassword } = req.body

    try {
        // FIXED: was `const isuser` then checked `if (!user)` — wrong variable name
        const isuser = await UserModel.findById(id)
        if (!isuser) {
            return res.status(404).send({
                message: "user not found"
            })
        }

        const isMatch = await bcrypt.compare(oldPassword, isuser.password)

        if (!isMatch) {
            return res.status(400).send({
                message: "Error with password validation"
            })
        }

        // FIXED: saltRound was 20 (extremely slow), reduced to 10
        const salt = await bcrypt.genSalt(10)
        const hashedPass = await bcrypt.hash(newPassword, salt)

        // FIXED: was findByIdAndUpdate({id}, ...) — should be just id (string)
        await UserModel.findByIdAndUpdate(id, { password: hashedPass }, { new: true })

        return res.status(200).send({
            message: "Password updated successfully"
        })

    } catch (error) {
        return res.status(500).send({
            message: "Server error",
            error: error.message
        });
    }
}

// VERIFY USER (middleware)
const verifyUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({
            message: "No token provided"
        });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return res.status(401).send({
            message: "Invalid token format"
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

        return res.status(401).send({
            message: "User unauthorized"
        });
    }
};

// REGISTER (Name, Email, Password, Confirm Password)
const register = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body

    if (!name?.trim() || !email?.trim() || !password || !confirmPassword) {
        return res.status(400).send({ message: 'Missing required fields: name, email, password, confirmPassword' })
    }

    if (password.length < 6) {
        return res.status(400).send({ message: 'Password must be at least 6 characters' })
    }

    if (password !== confirmPassword) {
        return res.status(400).send({ message: 'Passwords must match' })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()

    try {
        const saltRound = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, saltRound)

        const nameParts = trimmedName.split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] || trimmedName
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User'

        const user = await UserModel.create({
            firstName,
            lastName,
            email: trimmedEmail,
            password: hashedPassword,
            // FIXED: omit gender entirely instead of passing null,
            // so the schema enum validation is never triggered
        })

        const token = jwt.sign(
            { id: user._id.toString(), email: user.email },
            process.env.APP_TOKEN,
            { expiresIn: '5h' }
        )

        return res.status(201).send({
            message: 'User created successfully',
            data: { token }
        })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).send({ message: 'User already exists' })
        }

        console.log(error)
        return res.status(400).send({
            message: 'User failed to create',
            error: error.message,
            details: error?.errors || error?.keyValue || null
        })
    }
}

// ---- FORGOT PASSWORD (Email OTP) ----
const otpGenerator = require('otp-generator');
const OtpModel = require('../models/otp.model');
const nodemailer = require('nodemailer');

const sendMail = async ({ to, subject, text }) => {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        MAIL_FROM,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
        // fail loudly in dev; frontend will show error
        throw new Error('Missing SMTP configuration in environment variables');
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

// POST /forgot-password
const forgotPassword = async (req, res) => {
    const { email } = req.body || {};

    if (!email?.trim()) {
        return res.status(400).json({ message: 'email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // prevent account enumeration
    const user = await UserModel.findOne({ email: normalizedEmail });

    // Always return generic message
    const generic = {
        message: 'If an account exists for this email, you will receive a password reset code.',
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

        // Upsert OTP by email
        await OtpModel.findOneAndUpdate(
            { email: normalizedEmail },
            { otp },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const expiresInMinutes = 10;
        const subject = 'Password Reset Code';
        const text = `Your password reset code is: ${otp}\n\nIt will expire in ${expiresInMinutes} minutes.`;

        await sendMail({ to: normalizedEmail, subject, text });

        return res.status(200).json(generic);
    } catch (err) {
        console.error('forgotPassword error:', err);
        return res.status(500).json({ message: 'Failed to initiate password reset' });
    }
};

// POST /reset-password
const resetPassword = async (req, res) => {
    const { email, otp, newPassword, confirmPassword } = req.body || {};

    if (!email?.trim() || !otp || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'email, otp, newPassword, and confirmPassword are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords must match' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const otpDoc = await OtpModel.findOne({ email: normalizedEmail });
        if (!otpDoc) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const otpMatches = String(otpDoc.otp) === String(otp);
        if (!otpMatches) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const expiresInMs = 10 * 60 * 1000; // 10 minutes
        const createdAtMs = new Date(otpDoc.createdAt).getTime();
        if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > expiresInMs) {
            await OtpModel.deleteOne({ email: normalizedEmail });
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await UserModel.findOne({ email: normalizedEmail });
        if (!user) {
            await OtpModel.deleteOne({ email: normalizedEmail });
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(newPassword, salt);

        user.password = hashedPass;
        await user.save();

        await OtpModel.deleteOne({ email: normalizedEmail });

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('resetPassword error:', err);
        return res.status(500).json({ message: 'Failed to reset password' });
    }
};

module.exports = {
    addUserToDB,
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
}





