const express = require("express");
const { verifyUser } = require("../controller/user.controller");
const requireAdmin = require("../middleware/requireAdmin");
const {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controller/product.controller");

const router = express.Router();

router.get("/products", listProducts);

router.post("/products", verifyUser, requireAdmin, createProduct);
router.put("/products/:id", verifyUser, requireAdmin, updateProduct);
router.delete("/products/:id", verifyUser, requireAdmin, deleteProduct);

module.exports = router;

