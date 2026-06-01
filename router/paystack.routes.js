import express from "express";
import { verifyUser } from "../controller/user.controller.js";
import { initialize, verify } from "../controller/paystack.controller.js";

const router = express.Router();

// Initialize Paystack transaction
router.post("/initialize", verifyUser, initialize);

// Verify Paystack transaction and create order
router.post("/verify", verifyUser, verify);

export default router;

