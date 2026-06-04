import CartModel from "../models/cart.model.js";
import ProductModel from "../models/product.model.js";

const normalizeObjectId = (v) => (v?.toString ? v.toString() : String(v));

// POST /api/v1/checkout
// Minimal "checkout" implementation: creates an order-like response and clears cart.
// If you later add a real payment provider, replace the internals here.
const checkout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      fullName,
      email,
      phone,
      address1,
      city,
      country,
      paymentMethod,
    } = req.body || {};

    const required = {
      fullName,
      email,
      address1,
      city,
      country,
    };

    for (const [k, v] of Object.entries(required)) {
      if (!String(v || "").trim()) {
        return res.status(400).json({ message: `${k} is required` });
      }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const cart = await CartModel.findOne({ userId: normalizeObjectId(userId) }).populate(
      "items.productId"
    );

    const items = cart?.items || [];
    if (!items.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Recalculate totals from DB products to avoid tampering.
    let total = 0;
    const lineItems = [];

    for (const item of items) {
      const product = item.productId;
      if (!product) continue;

      const qty = Math.max(1, Number(item.quantity || 1));
      const price = Number(product.price || 0);
      total += price * qty;

      lineItems.push({
        productId: normalizeObjectId(product._id),
        name: product.name,
        collection: product.collection,
        imageUrl: product.imageUrl,
        price,
        quantity: qty,
        lineTotal: price * qty,
      });
    }

    if (!lineItems.length) {
      return res.status(400).json({ message: "No valid items in cart" });
    }

    // Create a simple order reference (no payment integration yet).
    const orderId = `AV-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

    // Clear cart after successful checkout.
    await CartModel.findOneAndUpdate(
      { userId: normalizeObjectId(userId) },
      { $set: { items: [] } },
      { new: true }
    );

    return res.status(201).json({
      message: "Checkout successful",
      data: {
        orderId,
        placedAt: new Date().toISOString(),
        total,
        currency: "USD",
        paymentMethod: paymentMethod || "card",
        shipping: {
          fullName,
          email,
          phone,
          address1,
          city,
          country,
        },
        items: lineItems,
      },
    });
  } catch (err) {
    console.error("checkout error:", err);
    next(err);
  }
};

export { checkout };

