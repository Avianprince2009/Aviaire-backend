import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";

const listProducts = async (req, res, next) => {
  try {
    const products = await ProductModel.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ message: "Products fetched successfully", data: products });
  } catch (error) {
    console.error("listProducts error:", error);
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, collection, price, imageUrl, description } = req.body || {};
    const trimmedName = String(name || "").trim();
    const trimmedCollection = String(collection || "").trim();
    const trimmedImageUrl = String(imageUrl || "").trim();
    const trimmedDescription = String(description || "").trim();
    const numericPrice = Number(price);

    if (!trimmedName) return res.status(400).json({ message: "name is required" });
    if (!trimmedCollection) return res.status(400).json({ message: "collection is required" });
    if (price === undefined || price === null || String(price).trim() === "") {
      return res.status(400).json({ message: "price is required" });
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: "price must be a valid non-negative number" });
    }
    if (!trimmedImageUrl) return res.status(400).json({ message: "imageUrl is required" });

    const created = await ProductModel.create({
      name: trimmedName,
      collection: trimmedCollection,
      price: numericPrice,
      imageUrl: trimmedImageUrl,
      description: trimmedDescription,
    });

    return res.status(201).json({ message: "Product created", data: created });
  } catch (error) {
    console.error("createProduct error:", {
      body: req.body,
      error,
    });
    if (error.name === "ValidationError") {
      return res.status(422).json({ message: "Validation failed", errors: error.errors });
    }
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, collection, price, imageUrl, description } = req.body || {};

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const update = {};
    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ message: "name cannot be empty" });
      }
      update.name = trimmedName;
    }
    if (collection !== undefined) {
      const trimmedCollection = String(collection).trim();
      if (!trimmedCollection) {
        return res.status(400).json({ message: "collection cannot be empty" });
      }
      update.collection = trimmedCollection;
    }
    if (price !== undefined && price !== null && String(price).trim() !== "") {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return res.status(400).json({ message: "price must be a valid non-negative number" });
      }
      update.price = numericPrice;
    }
    if (imageUrl !== undefined) {
      const trimmedImageUrl = String(imageUrl).trim();
      if (!trimmedImageUrl) {
        return res.status(400).json({ message: "imageUrl cannot be empty" });
      }
      update.imageUrl = trimmedImageUrl;
    }
    if (description !== undefined) {
      update.description = String(description).trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "At least one field is required to update" });
    }

    const updated = await ProductModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      context: "query",
    });

    if (!updated) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json({ message: "Product updated", data: updated });
  } catch (error) {
    console.error("updateProduct error:", {
      params: req.params,
      body: req.body,
      error,
    });
    if (error.name === "ValidationError") {
      return res.status(422).json({ message: "Validation failed", errors: error.errors });
    }
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const deleted = await ProductModel.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });

    return res.status(200).json({ message: "Product deleted", data: deleted });
  } catch (error) {
    console.error("deleteProduct error:", {
      params: req.params,
      error,
    });
    next(error);
  }
};

export { listProducts, createProduct, updateProduct, deleteProduct };