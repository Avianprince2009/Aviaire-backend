import express from "express";
import { verifyUser } from "../controller/user.controller.js";
import {
  getCart,
  addToCart,
  removeFromCart,
  updateQuantity,
} from "../controller/cart.controller.js";

const router = express.Router();

router.get("/cart", verifyUser, getCart);
router.post("/cart/add", verifyUser, addToCart);
router.post("/cart/remove", verifyUser, removeFromCart);
router.post("/cart/quantity", verifyUser, updateQuantity);

export default router;