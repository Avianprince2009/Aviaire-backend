import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { sendOtpMail } from './mailer.js'
import User from './models/User.js'
import Otp from './models/Otp.js'
import Product from './models/Product.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// Configure CORS: if FRONTEND_ORIGINS provided, restrict to those; otherwise allow all origins
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
if (FRONTEND_ORIGINS.length > 0) {
  app.use(
    cors({
      origin: function (origin, cb) {
        if (!origin) return cb(null, true)
        if (FRONTEND_ORIGINS.indexOf(origin) !== -1) return cb(null, true)
        cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
    })
  )
} else {
  app.use(cors())
}

// Connect to MongoDB if MONGO_URI is provided
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI, { autoIndex: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Mongo connect error', err))
} else {
  console.warn('No MONGO_URI provided; OTPs will not persist across restarts')
}

// Rate limiter per IP or email for forgot-password
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req.body && req.body.email) || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
})

// production uses MongoDB via models

// helper: hash OTP with pepper
function hashOtp(otp) {
  const pepper = process.env.OTP_PEPPER || ''
  return crypto.createHmac('sha256', pepper).update(String(otp)).digest('hex')
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

app.post('/api/v1/forgot-password', forgotLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ message: 'Missing email' })

    const otp = generateOtp()
    const hash = hashOtp(otp)
    const expiresMin = Number(process.env.OTP_EXPIRES_MIN || 15)
    const expiresAt = new Date(Date.now() + expiresMin * 60 * 1000)

    // upsert OTP doc in Mongo
    try {
      await Otp.findOneAndUpdate(
        { email: String(email).toLowerCase() },
        { hash, expiresAt, attempts: 0, createdAt: new Date() },
        { upsert: true, new: true }
      )
    } catch (e) {
      console.error('Failed to store OTP in Mongo', e)
    }

    // send OTP via email (nodemailer)
    const subject = 'Your L\'ALLURE password reset code'
    const text = `Your L'ALLURE password reset code is: ${otp}. It expires in ${expiresMin} minutes.`
    const html = `
      <html>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center" style="padding:24px 0;">
                <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 0 24px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding:24px 32px 0;text-align:center;">
                      <h1 style="margin:0;font-family:'Cinzel',serif;font-size:32px;color:#111;">L'ALLURE</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 32px 8px;color:#444;font-size:16px;line-height:1.6;">
                      <p style="margin:0 0 16px;">Hello,</p>
                      <p style="margin:0 0 24px;">You requested a password reset. Use the code below to continue. This code expires in ${expiresMin} minutes.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 32px 32px;">
                      <div style="display:inline-block;padding:18px 28px;background:#111;color:#fff;font-size:24px;font-weight:700;letter-spacing:4px;border-radius:12px;">${otp}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 24px;color:#777;font-size:14px;line-height:1.6;">
                      <p style="margin:0;">If you did not request a reset, please ignore this email. For security, do not share this code with anyone.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px;color:#999;font-size:12px;text-align:center;">
                      <p style="margin:0;">L'ALLURE • Elegant watches & fine collections</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>`
    await sendOtpMail({ to: email, subject, text, html })

    // always return 200 to avoid user enumeration
    return res.json({ message: 'If the email exists, an OTP has been sent' })
  } catch (e) {
    next(e)
  }
})

app.post('/api/v1/reset-password', async (req, res, next) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body || {}
    if (!email || !otp || !newPassword || !confirmPassword) return res.status(400).json({ message: 'Missing fields' })
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' })

    const doc = await Otp.findOne({ email: String(email).toLowerCase() })
    if (!doc) return res.status(400).json({ message: 'Invalid or expired code' })
    if (new Date() > doc.expiresAt) {
      await Otp.deleteOne({ _id: doc._id })
      return res.status(400).json({ message: 'Invalid or expired code' })
    }

    const candidateHash = hashOtp(otp)
    // safe compare: ensure same length before timingSafeEqual
    const storedBuf = Buffer.from(String(doc.hash), 'hex')
    const candBuf = Buffer.from(String(candidateHash), 'hex')
    if (storedBuf.length !== candBuf.length || !crypto.timingSafeEqual(candBuf, storedBuf)) {
      // increment attempts
      await Otp.findByIdAndUpdate(doc._id, { $inc: { attempts: 1 } })
      return res.status(400).json({ message: 'Invalid or expired code' })
    }

    // OTP is valid: update user's password in Mongo
    const pwHash = await bcrypt.hash(newPassword, 10)
    await User.findOneAndUpdate(
      { email: String(email).toLowerCase() },
      { passwordHash: pwHash },
      { upsert: true }
    )

    // invalidate OTP
    await Otp.deleteOne({ _id: doc._id })

    return res.json({ message: 'Password updated' })
  } catch (e) {
    next(e)
  }
})

// Products CRUD
app.get('/api/v1/products', async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 }).lean()
    return res.json({ data: products })
  } catch (e) {
    next(e)
  }
})

app.post('/api/v1/products', async (req, res, next) => {
  try {
    const { name, collection, price, imageUrl, description } = req.body || {}
    if (!name || !collection || price === undefined) return res.status(400).json({ message: 'Missing fields' })
    const prod = await Product.create({ name, collection, price: Number(price), imageUrl, description })
    return res.status(201).json({ data: prod })
  } catch (e) {
    next(e)
  }
})

app.put('/api/v1/products/:id', async (req, res, next) => {
  try {
    const id = req.params.id
    const { name, collection, price, imageUrl, description } = req.body || {}
    const updated = await Product.findByIdAndUpdate(id, { name, collection, price: Number(price), imageUrl, description }, { new: true, runValidators: true })
    if (!updated) return res.status(404).json({ message: 'Not found' })
    return res.json({ data: updated })
  } catch (e) {
    next(e)
  }
})

app.delete('/api/v1/products/:id', async (req, res, next) => {
  try {
    const id = req.params.id
    await Product.findByIdAndDelete(id)
    return res.json({ message: 'Deleted' })
  } catch (e) {
    next(e)
  }
})

// simple healthcheck
app.get('/api/v1/health', (req, res) => res.json({ ok: true }))

// 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }))

// error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Server error' })
})

app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`))
