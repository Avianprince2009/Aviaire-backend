import express from "express";
import { verifyUser } from "../controller/user.controller.js";
import { checkout } from "../controller/checkout.controller.js";

const router = express.Router();

router.post("/checkout", verifyUser, checkout);

export default router;

