const ProductModel = require("../models/product.model");

const listProducts = async (req, res) => {
  const products = await ProductModel.find({});
  return res.status(200).send({ message: "Products fetched successfully", data: products });
};

const createProduct = async (req, res) => {
  const { name, collection, price, imageUrl, description } = req.body || {};

  if (!name?.trim()) return res.status(400).send({ message: "name is required" });
  if (!collection?.trim()) return res.status(400).send({ message: "collection is required" });
  if (price === undefined || price === null) return res.status(400).send({ message: "price is required" });
  if (!imageUrl?.trim()) return res.status(400).send({ message: "imageUrl is required" });

  const created = await ProductModel.create({
    name: name.trim(),
    collection: collection.trim(),
    price: Number(price),
    imageUrl: imageUrl.trim(),
    description: (description ?? "").trim(),
  });

  return res.status(201).send({ message: "Product created", data: created });
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, collection, price, imageUrl, description } = req.body || {};

  const update = {};
  if (name?.trim()) update.name = name.trim();
  if (collection?.trim()) update.collection = collection.trim();
  if (price !== undefined) update.price = Number(price);
  if (imageUrl?.trim() !== undefined) update.imageUrl = String(imageUrl).trim();
  if (description !== undefined) update.description = String(description).trim();

  const updated = await ProductModel.findByIdAndUpdate(id, update, { new: true });

  if (!updated) return res.status(404).send({ message: "Product not found" });
  return res.status(200).send({ message: "Product updated", data: updated });
};


const deleteProduct = async (req, res) => {
  const { id } = req.params;

  const deleted = await ProductModel.findByIdAndDelete(id);
  if (!deleted) return res.status(404).send({ message: "Product not found" });

  return res.status(200).send({ message: "Product deleted", data: deleted });
};

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};

