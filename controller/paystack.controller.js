import axios from "axios";
import CartModel from "../models/cart.model.js";
import OrderModel from "../models/order.model.js";

function getEnv(name, fallback = "") {
  const v = process.env[name];
  if (v == null) return fallback;
  return String(v).trim();
}

function normalizeObjectId(v) {
  return v?.toString ? v.toString() : String(v);
}

function generateReference() {
  return `AV-${Date.now()}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

async function initialize(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { email, amount, amountKobo, shippingInfo } = req.body || {};

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: "email is required" });
    }

    const rawAmountKobo = amountKobo != null ? Number(amountKobo) : amount != null ? Math.round(Number(amount) * 100) : null;
    if (!rawAmountKobo || !Number.isFinite(rawAmountKobo) || rawAmountKobo <= 0) {
      return res.status(400).json({ success: false, message: "amount (or amountKobo) is required and must be > 0" });
    }

    if (!shippingInfo || typeof shippingInfo !== "object") {
      return res.status(400).json({ success: false, message: "shippingInfo is required" });
    }

    const requiredShippingFields = ["fullName", "email", "address1", "city", "country", "postalCode"];
    for (const field of requiredShippingFields) {
      if (!String(shippingInfo[field] || "").trim()) {
        return res.status(400).json({ success: false, message: `${field} is required in shippingInfo` });
      }
    }

    const paystackSecret = getEnv("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) return res.status(500).json({ success: false, message: "Paystack secret key is not configured" });

    const reference = generateReference();
    const frontendBase = getEnv('FRONTEND_URL') || req.headers.origin || '';
    const callbackUrl = frontendBase ? `${frontendBase.replace(/\/$/, '')}/payment-success` : undefined;

    const initUrl = "https://api.paystack.co/transaction/initialize";
    const payload = {
      email: String(email).trim(),
      amount: Number(rawAmountKobo),
      reference,
    };
    if (callbackUrl) payload.callback_url = callbackUrl;

    const resp = await axios.post(
      initUrl,
      payload,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const data = resp?.data?.data;
    if (!data || !data.authorization_url) {
      return res.status(502).json({ success: false, message: "Invalid response from Paystack" });
    }

    return res.status(200).json({ success: true, authorizationUrl: data.authorization_url, reference });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { reference } = req.body || {};
    const ref = String(reference || "").trim();
    if (!ref) return res.status(400).json({ success: false, message: "reference is required" });

    const paystackSecret = getEnv("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) return res.status(500).json({ success: false, message: "Paystack secret key is not configured" });

    console.log('[paystack:verify] start', { userId, reference: ref });

    // Prevent duplicate verification creating duplicate orders
    const existing = await OrderModel.findOne({ paymentReference: ref });
    if (existing) {
      console.log('[paystack:verify] existing order found for reference, clearing cart again', { userId, reference: ref });
      const clearedCart = await CartModel.findOneAndUpdate(
        { userId: normalizeObjectId(userId) },
        { $set: { items: [] } },
        { new: true }
      );
      console.log('[paystack:verify] cart cleared for existing order', { userId, remainingItems: clearedCart?.items?.length ?? 'no-cart' });
      return res.status(200).json({ success: true, message: "Order already exists for this reference", data: { orderId: existing.orderId } });
    }

    const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`;
    const resp = await axios.get(verifyUrl, { headers: { Authorization: `Bearer ${paystackSecret}` }, timeout: 15000 });
    const data = resp?.data?.data;
    if (!data) return res.status(502).json({ success: false, message: "Invalid response from Paystack" });

    console.log('[paystack:verify] paystack verify result', { status: data.status, amount: data.amount, currency: data.currency, reference: ref });

    if (data.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment not successful", paymentStatus: data.status });
    }

    // At this point payment is successful. Build order from user's cart.
    console.log('[paystack:verify] loading cart for user', userId);
    const cart = await CartModel.findOne({ userId: normalizeObjectId(userId) }).populate("items.productId");
    const items = cart?.items || [];
    if (!items.length) return res.status(400).json({ success: false, message: "Cart is empty" });

    const lineItems = [];
    let total = 0;
    for (const it of items) {
      const p = it.productId;
      if (!p) continue;
      const qty = Math.max(1, Number(it.quantity || it.qty || 1));
      const price = Number(p.price || 0);
      total += price * qty;
      lineItems.push({ productId: normalizeObjectId(p._id), name: p.name, collection: p.collection, imageUrl: p.imageUrl, price, quantity: qty, lineTotal: price * qty });
    }

    if (!lineItems.length) return res.status(400).json({ success: false, message: "Cart has invalid items" });

    const orderId = `AV-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    const amountKobo = Number(data.amount != null ? data.amount : Math.round(total * 100));

    // Shipping info: try to use metadata if provided by Paystack else request body
    const shippingFromBody = req.body.shippingInfo || req.body || {};
    const shipping = {
      fullName: String(shippingFromBody.fullName || shippingFromBody.name || data?.customer?.first_name || "").trim(),
      email: String(shippingFromBody.email || data?.customer?.email || "").trim(),
      phone: String(shippingFromBody.phone || data?.customer?.phone || "").trim(),
      address1: String(shippingFromBody.address1 || "").trim(),
      city: String(shippingFromBody.city || "").trim(),
      country: String(shippingFromBody.country || "").trim(),
      postalCode: String(shippingFromBody.postalCode || shippingFromBody.zip || "").trim(),
    };

    // Basic validation of shipping
    const required = ["fullName", "email", "address1", "city", "country", "postalCode"];
    for (const k of required) {
      if (!String(shipping[k] || "").trim()) {
        return res.status(400).json({ success: false, message: `${k} is required` });
      }
    }

    const order = await OrderModel.create({
      user: normalizeObjectId(userId),
      orderId,
      paymentReference: ref,
      paymentStatus: "paid",
      amount: amountKobo,
      currency: data.currency || "NGN",
      shipping,
      orderDetails: { items: lineItems, total, placedAt: new Date() },
    });

    console.log('[paystack:verify] order created', { orderId: order.orderId, userId, itemCount: lineItems.length, total });

    // Clear cart after successful order
    const clearedCart = await CartModel.findOneAndUpdate(
      { userId: normalizeObjectId(userId) },
      { $set: { items: [] } },
      { new: true }
    );
    console.log('[paystack:verify] cart cleared for user', userId, 'remainingItems', clearedCart?.items?.length ?? 'no-cart');

    return res.status(201).json({ success: true, message: "Payment verified and order saved", data: { orderId: order.orderId, placedAt: order.orderDetails?.placedAt, total, paymentReference: ref, paymentStatus: order.paymentStatus } });
  } catch (err) {
    next(err);
  }
}

export { initialize, verify };
