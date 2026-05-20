import nodemailer from 'nodemailer'

let transporter = null

export function getTransporterFromEnv(env) {
  if (transporter) return transporter
  const host = env.SMTP_HOST
  if (!host) return null

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || 'false') === 'true',
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  })

  return transporter
}

export async function sendOtpMail({ to, subject, text, html, env = process.env }) {
  const t = getTransporterFromEnv(env)
  if (!t) {
    // fallback to logging in dev
    console.log('[mailer] SMTP not configured, OTP message would be:', { to, subject, text })
    return { ok: true, logged: true }
  }

  const info = await t.sendMail({ from: env.FROM_EMAIL || env.SMTP_USER, to, subject, text, html })
  return { ok: true, info }
}
