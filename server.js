import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const UserRouter = require('./router/user.routes.js')
const cartRoutes = require('./router/cart.routes.js')
const productRoutes = require('./router/product.routes.js')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const DEFAULT_CORS_ORIGINS = [
  'https://aviaire.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost',
]

const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const allowedOrigins = FRONTEND_ORIGINS.length > 0 ? FRONTEND_ORIGINS : DEFAULT_CORS_ORIGINS

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`Blocked by CORS: ${origin}`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  credentials: false,
  optionsSuccessStatus: 200,
}

app.use(helmet())
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.use((req, res, next) => {
  console.debug('[request]', {
    method: req.method,
    path: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
  })
  next()
})

// Connect to MongoDB if MONGO_URI is provided
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL
if (MONGO_URI) {
  mongoose.set('strictQuery', true)
  mongoose
    .connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: process.env.NODE_ENV !== 'production',
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
      console.error('Mongo connect error', err)
      process.exit(1)
    })
} else {
  console.warn('No MONGO_URI provided; OTPs and products will not persist across restarts')
}

app.use('/api/v1', UserRouter)
app.use('/api/v1', cartRoutes)
app.use('/api/v1', productRoutes)

// simple healthcheck
app.get('/api/v1/health', (req, res) => res.json({ ok: true }))

// 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }))

// error handler - keep CORS headers on error responses
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', {
    message: err?.message,
    stack: err?.stack,
    params: req.params,
    body: req.body,
    origin: req.headers.origin,
  })

  const requestOrigin = req.headers.origin
  if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With')
  }

  const status = err?.status || 500
  const message = err?.message || 'Server error'
  res.status(status).json({ message })
})

app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`))
