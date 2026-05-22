import express from "express";
import {
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
} from "../controller/user.controller.js";

const router = express.Router();

// register (Name, Email, Password, Confirm Password)
router.post("/register", register);

// protected route
router.get("/getUsers", verifyUser, getUsers);

// get single user
router.get("/getUser/:id", getUser);

// update user
router.put("/editUser/:id", editUser);

// delete user
router.delete("/deleteUser/:id", deleteUser);

// login user
router.post("/login", login);

//change Password
router.patch("/changepassword", verifyUser, changePassword);

// forgot password (email OTP)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;