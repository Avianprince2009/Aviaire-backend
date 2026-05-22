import express from "express";
import { verifyUser } from "../controller/user.controller.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controller/product.controller.js";

const router = express.Router();

router.get("/products", listProducts);

router.post("/products", verifyUser, requireAdmin, createProduct);
router.put("/products/:id", verifyUser, requireAdmin, updateProduct);
router.delete("/products/:id", verifyUser, requireAdmin, deleteProduct);

export default router;