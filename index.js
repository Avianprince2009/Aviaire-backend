require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const connectDB = require("./connectDB");
const cors = require("cors");

const app = express();

dotenv.config();

/* =========================
   MIDDLEWARE
========================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

/* =========================
   CORS (FIXED FOR PRODUCTION)
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost",
  "https://aviaire.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow Postman/mobile apps

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Blocked by CORS: " + origin));
      }
    },
    credentials: false,
  })
);

/* =========================
   DATABASE
========================= */

connectDB();

/* =========================
   SEED DATA
========================= */

try {
  const { seedProductsIfEmpty } = require("./seed/seedProducts");

  seedProductsIfEmpty()
    .then((r) => {
      if (r?.seeded) {
        console.log(`[seed] Seeded ${r.createdCount} products`);
      } else {
        console.log(`[seed] Products already exist (${r?.count})`);
      }
    })
    .catch((e) =>
      console.error("[seed] Failed to seed products:", e?.message || e)
    );
} catch (e) {
  console.error("[seed] Init error:", e?.message || e);
}

/* =========================
   ROUTES
========================= */

const UserRouter = require("./router/user.routes");
const cartRoutes = require("./router/cart.routes");
const productRoutes = require("./router/product.routes");

app.use("/api/v1", UserRouter);
app.use("/api/v1", cartRoutes);
app.use("/api/v1", productRoutes);

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({ message: "Backend is running successfully" });
});

app.get("/Users", (req, res) => {
  res.status(301).json({ message: "Use /api/v1 endpoints" });
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
    message: "Internal Server Error",
    error: err?.message || String(err),
  });
});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 3000;

app
  .listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${PORT} is busy, trying ${PORT + 1}`);
      app.listen(PORT + 1, () => {
        console.log(`Server started on http://localhost:${PORT + 1}`);
      });
    } else {
      console.error("Server cannot start:", err);
      process.exit(1);
    }
  });