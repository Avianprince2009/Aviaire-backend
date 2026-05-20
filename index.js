require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const connectDB = require("./connectDB");
const app = express();

dotenv.config();


app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));


const cors = require('cors');
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost"],
  credentials: false,
}));


connectDB();

// Seed initial products into Mongo once (only if collection is empty)
try {
  const { seedProductsIfEmpty } = require('./seed/seedProducts');
  seedProductsIfEmpty()
    .then((r) => {
      if (r?.seeded) console.log(`[seed] Seeded ${r.createdCount} products`);
      else console.log(`[seed] Products already exist (${r?.count})`);
    })
    .catch((e) => console.error('[seed] Failed to seed products:', e?.message || e));
} catch (e) {
  console.error('[seed] Init error:', e?.message || e);
}


const UserRouter = require("./router/user.routes");
const cartRoutes = require("./router/cart.routes");
const productRoutes = require("./router/product.routes");

app.use('/api/v1', UserRouter);
app.use('/api/v1', cartRoutes);
app.use('/api/v1', productRoutes);

let User = 'luqman';
let gender = 'male';

const cars = [
    { name: 'BMW', price: 50000, year: 2023, color: 'black' },
    { name: 'Audi', price: 60000, year: 2022, color: 'white' },
    { name: 'Mercedes', price: 70000, year: 2023, color: 'silver' },
    { name: 'Toyota', price: 35000, year: 2021, color: 'blue' },
    { name: 'Honda', price: 40000, year: 2022, color: 'red' },
    { name: 'Tesla', price: 80000, year: 2023, color: 'white' }
];

app.get('/', (req, res) => {
    res.render('index', { User, gender, cars });
});

app.get('/Users', (req, res) => {
    res.redirect('/');
});

app.get('/index', (req, res) => {
    res.render('index', { User, gender, cars });
});

// Note: legacy EJS demo routes removed.
// This backend is primarily an API under /api/v1.

// Ensure API always returns JSON (prevents frontend JSON.parse('<!DOCTYPE ...') issues)
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// JSON 404 for unknown routes (must be after all route handlers)
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// JSON error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send({
    message: 'Internal Server Error',
    error: err?.message || String(err),
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is busy, trying ${PORT + 1}`);
        app.listen(PORT + 1, () => {
            console.log(`Server started on http://localhost:${PORT + 1}`);
        });
    } else {
        console.error('Server cannot start:', err);
        process.exit(1);
    }
});

