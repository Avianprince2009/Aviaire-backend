import dns from "node:dns/promises";
import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

import UserRouter from "./router/user.routes.js";
import cartRoutes from "./router/cart.routes.js";
import productRoutes from "./router/product.routes.js";
import paystackRoutes from "./router/paystack.routes.js";
import orderRoutes from "./router/order.routes.js";

import { seedProductsIfEmpty } from "./seed/seedProducts.js";


/* =========================
   DNS
========================= */

dns.setServers(["1.1.1.1", "8.8.8.8"]);

/* =========================
   APP INIT
========================= */

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_CORS_ORIGINS = [
  "https://aviaire.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://localhost",
];

const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = FRONTEND_ORIGINS.length > 0 ? FRONTEND_ORIGINS : DEFAULT_CORS_ORIGINS;

/* =========================
   MIDDLEWARE ORDER:
   1. helmet (security headers)
   2. cors
   3. morgan (logging)
   4. express.json / urlencoded
   5. routes
   6. 404
   7. error handler
========================= */

app.use(helmet());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Blocked by CORS: " + origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With", "Origin"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* =========================
   DATABASE
========================= */

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
if (MONGO_URI) {
  mongoose.set("strictQuery", true);
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
      console.error("Mongo connect error", err);
      process.exit(1);
    });
} else {
  console.warn("No MONGO_URI provided; OTPs and products will not persist across restarts");
}

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
app.use("/api/v1/paystack", paystackRoutes);
app.use("/api/v1", orderRoutes);


/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running successfully",
  });
});

app.get("/api/v1/health", (req, res) => {
  res.json({ ok: true });
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
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error("Unhandled error:", {
    message: err?.message,
    stack: err?.stack,
    params: req.params,
    body: req.body,
    origin: req.headers.origin,
  });

  const requestOrigin = req.headers.origin;
  if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin || "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,Accept,X-Requested-With,Origin"
    );
  }

  const status = err?.status || 500;
  const message = err?.message || "Server error";
  res.status(status).json({ success: false, message });
});

/* =========================
   SERVER START
========================= */

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});