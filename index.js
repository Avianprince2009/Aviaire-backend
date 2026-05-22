import dns from "node:dns/promises";
import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./connectDB.js";

import UserRouter from "./router/user.routes.js";
import cartRoutes from "./router/cart.routes.js";
import productRoutes from "./router/product.routes.js";

import { seedProductsIfEmpty } from "./seed/seedProducts.js";

/* =========================
   DNS
========================= */

dns.setServers(["1.1.1.1", "8.8.8.8"]);

/* =========================
   APP INIT
========================= */

const app = express();

dotenv.config();

/* =========================
   MIDDLEWARE
========================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

/* =========================
   CORS
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost",
  "https://aviaire.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin (Postman/mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Blocked by CORS: " + origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

/* =========================
   DATABASE
========================= */

connectDB();

/* =========================
   SEED DATA
========================= */

seedProductsIfEmpty()
  .then((r) => {
    if (r?.seeded) {
      console.log(`[seed] Seeded ${r.createdCount} products`);
    } else {
      console.log(`[seed] Products already exist (${r?.count})`);
    }
  })
  .catch((e) => {
    console.error("[seed] Failed to seed products:", e?.message || e);
  });

/* =========================
   ROUTES
========================= */

app.use("/api/v1", UserRouter);
app.use("/api/v1", cartRoutes);
app.use("/api/v1", productRoutes);

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running successfully",
  });
});

app.get("/Users", (req, res) => {
  res.status(301).json({
    message: "Use /api/v1 endpoints",
  });
});

/* =========================
   FORCE JSON RESPONSE
========================= */

app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* =========================
   SAFE RENDER GUARD
========================= */

app.use((req, res, next) => {
  if (typeof res.render === "function") {
    res.render = () => {
      return res.status(500).json({
        success: false,
        message: "API-only backend: view rendering disabled",
      });
    };
  }

  next();
});

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err?.message || String(err),
  });
});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});