import express from "express";
import axios from "axios";

import { verifyUser } from "../controller/user.controller.js";
import CartModel from "../models/cart.model.js";
import OrderModel from "../models/order.model.js";

const router = express.Router();

function getEnv(name, fallback = "") {
  const v = process.env[name];
  if (v == null) return fallback;
  return String(v).trim();
}

function normalizeObjectId(v) {
  return v?.toString ? v.toString() : String(v);
}

async function buildOrderFromCartAndShipping({ userId }) {
  const cart = await CartModel.findOne({ userId: normalizeObjectId(userId) }).populate(
    "items.productId"
  );

  const items = cart?.items || [];
  if (!items.length) return { lineItems: [], total: 0 };

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

  return { lineItems, total };
}

// POST /api/v1/paystack/initialize
// Body: { amountKobo, currency, reference }
// Returns: { reference, authorizationUrl, accessCode }
router.post("/initialize", verifyUser, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    console.log("[paystack/initialize] Starting request for user:", userId);
    
    if (!userId) {
      console.error("[paystack/initialize] No user ID in request");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      amountKobo,
      currency = "NGN",
      reference,
      email,
      // shipping fields are accepted but not used for Paystack itself
      // (Paystack doesn't need them to start checkout)
    } = req.body || {};

    console.log("[paystack/initialize] Request body:", { amountKobo, currency, reference, email });

    if (amountKobo == null || !Number.isFinite(Number(amountKobo)) || Number(amountKobo) <= 0) {
      console.error("[paystack/initialize] Invalid amountKobo:", amountKobo);
      return res.status(400).json({ message: "amountKobo is required" });
    }

    const finalReference = String(reference || `AV-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`);

    const paystackPublic = getEnv("PAYSTACK_PUBLIC_KEY");
    const paystackSecret = getEnv("PAYSTACK_SECRET_KEY");

    if (!paystackPublic) {
      console.error("[paystack/initialize] PAYSTACK_PUBLIC_KEY is missing");
      return res.status(500).json({ message: "Paystack public key is missing" });
    }
    if (!paystackSecret) {
      console.error("[paystack/initialize] PAYSTACK_SECRET_KEY is missing");
      return res.status(500).json({ message: "Paystack secret key is missing" });
    }

    const initUrl = "https://api.paystack.co/transaction/initialize";

    console.log("[paystack/initialize] Calling Paystack API at:", initUrl);

    const initResp = await axios.post(
      initUrl,
      {
        email: email || "customer@example.com",
        amount: Number(amountKobo),
        reference: finalReference,
        currency,
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const data = initResp?.data?.data;
    console.log("[paystack/initialize] Paystack response:", { 
      status: initResp?.status,
      hasData: !!data,
      authUrl: !!data?.authorization_url,
      accessCode: !!data?.access_code 
    });

    if (!data?.authorization_url || !data?.access_code) {
      console.error("[paystack/initialize] Invalid Paystack response - missing authorization_url or access_code");
      return res.status(400).json({ message: "Invalid Paystack initialize response" });
    }

    console.log("[paystack/initialize] Success - returning auth URL and access code");
    return res.status(201).json({
      reference: finalReference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      accessCodeForClient: data.access_code, // keep for backward compatibility
    });
  } catch (err) {
    console.error("[paystack/initialize] Error:", {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
      stack: err?.stack
    });
    next(err);
  }
});

// POST /api/v1/paystack/verify
// Body: { reference, fullName, email, phone, address1, city, country, postalCode }
router.post("/verify", verifyUser, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    console.log("[paystack/verify] Starting verification for user:", userId);
    
    if (!userId) {
      console.error("[paystack/verify] No user ID in request");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { reference } = req.body || {};
    const finalReference = String(reference || "").trim();
    
    console.log("[paystack/verify] Processing reference:", finalReference);
    
    if (!finalReference) {
      console.error("[paystack/verify] No reference provided");
      return res.status(400).json({ message: "reference is required" });
    }

    const paystackSecret =
      getEnv("PAYSTACK_SECRET_KEY") || getEnv("PAYSTACK_SECRET") || getEnv("PAYSTACK_SECRET_KEY");

    if (!paystackSecret) {
      console.error("[paystack/verify] PAYSTACK_SECRET_KEY is missing");
      return res.status(500).json({ message: "Paystack secret key is missing" });
    }

    const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(finalReference)}`;
    console.log("[paystack/verify] Calling Paystack verify API");

    const verifyResp = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        Accept: "application/json",
      },
      timeout: 15000,
    });

    const data = verifyResp?.data?.data;
    console.log("[paystack/verify] Paystack response:", { 
      status: verifyResp?.status,
      paymentStatus: data?.status,
      amount: data?.amount 
    });

    if (!data) {
      console.error("[paystack/verify] Invalid Paystack verification response");
      return res.status(400).json({ message: "Invalid Paystack verification response" });
    }

    if (data.status !== "success") {
      console.error("[paystack/verify] Payment not successful, status:", data.status);
      return res.status(400).json({ message: "Payment not successful", paymentStatus: data.status });
    }

    const {
      fullName,
      email,
      phone,
      address1,
      city,
      country,
      postalCode,
    } = req.body || {};

    const required = { fullName, email, address1, city, country, postalCode };
    for (const [k, v] of Object.entries(required)) {
      if (!String(v || "").trim()) {
        console.error(`[paystack/verify] Missing required field: ${k}`);
        return res.status(400).json({ message: `${k} is required` });
      }
    }

    const existing = await OrderModel.findOne({ paymentReference: finalReference });
    if (existing) {
      console.log("[paystack/verify] Order already exists for this reference:", existing.orderId);
      return res.status(200).json({
        message: "Order already exists for this payment reference",
        data: { orderId: existing.orderId },
      });
    }

    console.log("[paystack/verify] Building order from cart for user:", userId);
    const { lineItems, total } = await buildOrderFromCartAndShipping({ userId });
    if (!lineItems.length) {
      console.error("[paystack/verify] Cart is empty for user:", userId);
      return res.status(400).json({ message: "Cart is empty" });
    }

    const orderId = `AV-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    const amountKobo = data?.amount != null ? Number(data.amount) : Math.round(Number(total) * 100);

    console.log("[paystack/verify] Creating order:", { orderId, amount: amountKobo, reference: finalReference });

    const order = await OrderModel.create({
      user: normalizeObjectId(userId),
      orderId,
      paymentReference: finalReference,
      paymentStatus: "paid",
      amount: amountKobo,
      currency: data.currency || "NGN",
      shipping: {
        fullName,
        email,
        phone: phone || "",
        address1,
        city,
        country,
        postalCode,
      },
      orderDetails: {
        items: lineItems,
        total,
        placedAt: new Date(),
      },
    });

    // Clear cart only after successful save
    console.log("[paystack/verify] Clearing cart for user:", userId);
    await CartModel.findOneAndUpdate(
      { userId: normalizeObjectId(userId) },
      { $set: { items: [] } },
      { new: true }
    );

    console.log("[paystack/verify] Success - order created:", orderId);
    return res.status(201).json({
      message: "Payment verified and order saved",
      data: {
        orderId: order.orderId,
        placedAt: order.orderDetails?.placedAt?.toISOString?.() || new Date().toISOString(),
        total,
        paymentReference: finalReference,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (err) {
    console.error("[paystack/verify] Error:", {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
      stack: err?.stack
    });
    next(err);
  }
});

export default router;

