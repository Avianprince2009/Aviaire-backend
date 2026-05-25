import express from "express";

// Payment flow is Paystack-only.
// The old /checkout endpoint was a fake/dummy flow.
// Keep route removed to avoid mixed logic.

const router = express.Router();

export default router;


