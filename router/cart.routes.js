const express = require("express");
const { verifyUser } = require("../controller/user.controller");
const {
  getCart,
  addToCart,
  removeFromCart,
  updateQuantity,
} = require("../controller/cart.controller");

const router = express.Router();

router.get("/cart", verifyUser, getCart);
router.post("/cart/add", verifyUser, addToCart);
router.post("/cart/remove", verifyUser, removeFromCart);
router.post("/cart/quantity", verifyUser, updateQuantity);

module.exports = router;

