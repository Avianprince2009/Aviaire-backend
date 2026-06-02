import express from "express";
import { verifyUser } from "../controller/user.controller.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controller/order.controller.js";

const router = express.Router();

router.get("/orders", verifyUser, requireAdmin, getOrders);
router.get("/orders/:id", verifyUser, requireAdmin, getOrderById);
router.patch("/orders/:id/status", verifyUser, requireAdmin, updateOrderStatus);
router.delete("/orders/:id", verifyUser, requireAdmin, deleteOrder);

export default router;

