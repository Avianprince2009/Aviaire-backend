import CartModel from "../models/cart.model.js";
import ProductModel from "../models/product.model.js";

const getCart = async (req, res) => {
  const userId = req.user.id;
  const userIdStr = userId?.toString?.() || String(userId);
  console.log("[cart:getCart] req.user.id=", userId, "asString=", userIdStr);

  const cart = await CartModel.findOne({ userId: userIdStr }).populate("items.productId");

  console.log(
    "[cart:getCart] cart found?",
    !!cart,
    "items=",
    cart?.items?.length,
    "rawItemsProductIds=",
    cart?.items?.map((i) => i?.productId?.toString?.() || String(i?.productId))
  );

  return res.status(200).json({
    message: "Cart fetched successfully",
    data: cart || { userId, items: [] },
  });
};

const addToCart = async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body || {};

  if (!productId) return res.status(400).json({ message: "productId is required" });

  const qty = Math.max(1, Number(quantity || 1));

  let normalizedProductId = productId;
  if (/^\d+$/.test(String(productId))) {
    const numericId = Number(productId);
    const product = await ProductModel.findOne({ id: numericId });
    if (!product) return res.status(404).json({ message: "Product not found" });
    normalizedProductId = product._id;
  } else {
    const product = await ProductModel.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    normalizedProductId = product._id;
  }

  normalizedProductId = normalizedProductId.toString ? normalizedProductId : normalizedProductId;

  const cart = await CartModel.findOne({ userId });
  if (!cart) {
    const created = await CartModel.create({ userId, items: [{ productId: normalizedProductId, quantity: qty }] });
    return res.status(201).json({ message: "Added to cart", data: created });
  }

  const existing = cart.items.find((i) => i.productId.toString() === normalizedProductId.toString());
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({ productId: normalizedProductId, quantity: qty });
  }

  await cart.save();

  const updated = await CartModel.findOne({ userId }).populate("items.productId");
  return res.status(200).json({ message: "Added to cart", data: updated });
};

const removeFromCart = async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body || {};

  if (!productId) return res.status(400).json({ message: "productId is required" });

  const cart = await CartModel.findOne({ userId });
  if (!cart) return res.status(200).json({ message: "Cart is empty", data: { userId, items: [] } });

  let normalizedProductId = productId;
  if (/^\d+$/.test(String(productId))) {
    const numericId = Number(productId);
    const product = await ProductModel.findOne({ id: numericId });
    if (product) normalizedProductId = product._id;
  }

  cart.items = cart.items.filter((i) => i.productId.toString() !== normalizedProductId.toString());

  await cart.save();

  const updated = await CartModel.findOne({ userId }).populate("items.productId");
  return res.status(200).json({ message: "Removed from cart", data: updated });
};

const updateQuantity = async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body || {};

  if (!productId) return res.status(400).json({ message: "productId is required" });

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return res.status(400).json({ message: "quantity must be >= 1" });
  }

  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    cart = await CartModel.create({ userId, items: [] });
  }

  let normalizedProductId = productId;

  if (/^\d+$/.test(String(productId))) {
    const numericId = Number(productId);
    const product = await ProductModel.findOne({ id: numericId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    normalizedProductId = product._id;
  }

  normalizedProductId = normalizedProductId.toString ? normalizedProductId : normalizedProductId;

  const item = cart.items.find((i) => i.productId.toString() === normalizedProductId);

  if (!item) {
    cart.items.push({ productId: normalizedProductId, quantity: qty });
    await cart.save();
  } else {
    item.quantity = qty;
    await cart.save();
  }

  const updated = await CartModel.findOne({ userId }).populate("items.productId");
  return res.status(200).json({ message: "Quantity updated", data: updated });
};

export { getCart, addToCart, removeFromCart, updateQuantity };