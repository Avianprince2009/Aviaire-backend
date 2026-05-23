import express from "express";
import axios from "axios";

import { verifyUser } from "../controller/user.controller.js";
import CartModel from "../models/cart.model.js";
import ProductModel from "../models/product.model.js";
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

async function buildOrderFromCartAndShipping({ userId, shipping }) {
  const cart = await CartModel.findOne({ userId: normalizeObjectId(userId) }).populate(
    "items.productId"
  );

  const items = cart?.items || [];
  if (!items.length) {
    return { lineItems: [], total: 0 };
  }

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

// POST /api/v1/paystack/verify
// Body: { reference, paymentReference? }
router.post("/paystack/verify", verifyUser, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { reference, paymentReference } = req.body || {};
    const finalReference = String(reference || paymentReference || "").trim();

    if (!finalReference) {
      return res.status(400).json({ message: "reference is required" });
    }

    // Paystack secret (backend only)
    const paystackSecret =
      getEnv("PAYSTACK_SECRET_KEY") ||
      getEnv("PAYSTACK_SECRET") ||
      getEnv("VITE_PAYSTACK_SECRET_KEY") ||
      getEnv("PAYSTACK_SECRET_KEY");

    if (!paystackSecret) {
      return res.status(500).json({ message: "Paystack secret key is missing" });
    }

    // Verify payment with Paystack
    const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(
      finalReference
    )}`;

    const verifyResp = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        Accept: "application/json",
      },
      timeout: 15000,
    });

    const data = verifyResp?.data?.data;

    if (!data) {
      return res.status(400).json({ message: "Invalid Paystack verification response" });
    }

    const status = data.status;
    if (status !== "success") {
      return res.status(400).json({ message: "Payment not successful", paymentStatus: status });
    }

    // Use shipping details from request body (frontend sends them)
    // If shipping fields are missing, fail (so we don't save incomplete orders)
    const {
      fullName,
      email,
      phone,
      address1,
      city,
      country,
      postalCode,
    } = req.body || {};

    const required = {
      fullName,
      email,
      address1,
      city,
      country,
      postalCode,
    };

    for (const [k, v] of Object.entries(required)) {
      if (!String(v || "").trim()) {
        return res.status(400).json({ message: `${k} is required` });
      }
    }

    // Prevent duplicate orders for same reference
    const existing = await OrderModel.findOne({ paymentReference: finalReference });
    if (existing) {
      return res.status(200).json({
        message: "Order already exists for this payment reference",
        data: { orderId: existing.orderId },
      });
    }

    const { lineItems, total } = await buildOrderFromCartAndShipping({
      userId,
      shipping: req.body,
    });

    if (!lineItems.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

      // Create order
      const orderId = `AV-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

      // Paystack returns amount in kobo.
      // total from DB is in major currency units (based on your product.price), so we convert as a fallback.
      const amountKobo =
        data?.amount != null ? Number(data.amount) : Math.round(Number(total) * 100);

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

    // Clear cart only after verification + successful save
    await CartModel.findOneAndUpdate(
      { userId: normalizeObjectId(userId) },
      { $set: { items: [] } },
      { new: true }
    );

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
    console.error("paystack verify error:", err?.response?.data || err);
    next(err);
  }
});

export default router;

