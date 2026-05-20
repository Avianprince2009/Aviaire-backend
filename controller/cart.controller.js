const CartModel = require("../models/cart.model");
const ProductModel = require("../models/product.model");

const getCart = async (req, res) => {
  const userId = req.user.id
  const userIdStr = userId?.toString?.() || String(userId)
  console.log('[cart:getCart] req.user.id=', userId, 'asString=', userIdStr)

  const cart = await CartModel.findOne({ userId: userIdStr }).populate('items.productId')

  console.log(
    '[cart:getCart] cart found?',
    !!cart,
    'items=',
    cart?.items?.length,
    'rawItemsProductIds=',
    cart?.items?.map((i) => i?.productId?.toString?.() || String(i?.productId))
  )

  return res.status(200).send({
    message: 'Cart fetched successfully',
    data: cart || { userId, items: [] },
  })
};

const addToCart = async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body || {};

  if (!productId) return res.status(400).send({ message: "productId is required" });

  const qty = Math.max(1, Number(quantity || 1));


  // Frontend sometimes sends numeric seed ids (1/2/3). Map them to Mongo Product by `id`.
  let normalizedProductId = productId;
  if (/^\d+$/.test(String(productId))) {
    const numericId = Number(productId);
    const product = await ProductModel.findOne({ id: numericId });
    if (!product) return res.status(404).send({ message: "Product not found" });
    normalizedProductId = product._id;
  } else {
    const product = await ProductModel.findById(productId);
    if (!product) return res.status(404).send({ message: "Product not found" });
    normalizedProductId = product._id;
  }

  // normalizedProductId must be Mongo ObjectId stored in cart.items.productId
  normalizedProductId = normalizedProductId.toString ? normalizedProductId : normalizedProductId;



  const cart = await CartModel.findOne({ userId });
  if (!cart) {
    const created = await CartModel.create({ userId, items: [{ productId: normalizedProductId, quantity: qty }] });
    return res.status(201).send({ message: "Added to cart", data: created });
  }

  const existing = cart.items.find((i) => i.productId.toString() === normalizedProductId.toString());
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({ productId: normalizedProductId, quantity: qty });
  }


  await cart.save();

  const updated = await CartModel.findOne({ userId }).populate("items.productId");
  return res.status(200).send({ message: "Added to cart", data: updated });
};

const removeFromCart = async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body || {};

  if (!productId) return res.status(400).send({ message: "productId is required" });

  const cart = await CartModel.findOne({ userId });
  if (!cart) return res.status(200).send({ message: "Cart is empty", data: { userId, items: [] } });

  // Map numeric seed ids (1/2/3) to Mongo product ids before filtering.
  let normalizedProductId = productId;
  if (/^\d+$/.test(String(productId))) {
    const numericId = Number(productId);
    const product = await ProductModel.findOne({ id: numericId });
    if (product) normalizedProductId = product._id;
  }

  cart.items = cart.items.filter((i) => i.productId.toString() !== normalizedProductId.toString());

  await cart.save();

  const updated = await CartModel.findOne({ userId }).populate("items.productId");
  return res.status(200).send({ message: "Removed from cart", data: updated });
};

const updateQuantity = async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body || {};

  if (!productId) return res.status(400).send({ message: "productId is required" });

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return res.status(400).send({ message: "quantity must be >= 1" });
  }

  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    // Ensure cart document exists so quantity updates don't fail on first update.
    cart = await CartModel.create({ userId, items: [] });
  }

  // productId coming from the frontend may be a numeric seed id (1/2/3).
  // If numeric id is received, map it to the real Mongo product by `id` field.
  // (Your App uses numeric `id` as seed identifier.)
  let normalizedProductId = productId

  if (/^\d+$/.test(String(productId))) {
    const numericId = Number(productId)
    const product = await ProductModel.findOne({ id: numericId })
    if (!product) {
      return res.status(404).send({ message: "Product not found" })
    }
    normalizedProductId = product._id
  }

  // normalizedProductId must be the Mongo ObjectId stored in cart.items.productId
  normalizedProductId = normalizedProductId.toString ? normalizedProductId : normalizedProductId



  const item = cart.items.find((i) => i.productId.toString() === normalizedProductId);

  if (!item) {
    // create missing item only when productId is a valid ObjectId
    cart.items.push({ productId: normalizedProductId, quantity: qty });
    await cart.save();
  } else {
    item.quantity = qty;
    await cart.save();
  }



  const updated = await CartModel.findOne({ userId }).populate("items.productId");
  return res.status(200).send({ message: "Quantity updated", data: updated });
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  updateQuantity,
};

