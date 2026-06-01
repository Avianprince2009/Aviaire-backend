import nodemailer from "nodemailer";

const normalizeString = (v) => (v == null ? "" : String(v).trim());

const validateBody = (body) => {
  const name = normalizeString(body?.name);
  const email = normalizeString(body?.email);
  const subject = normalizeString(body?.subject);
  const message = normalizeString(body?.message);

  if (!name) return { ok: false, error: "name is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email" };
  }
  if (!subject) return { ok: false, error: "subject is required" };
  if (!message) return { ok: false, error: "message is required" };

  return { ok: true, data: { name, email, subject, message } };
};

export const contact = async (req, res) => {
  const validation = validateBody(req.body || {});
  if (!validation.ok) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  const { name, email, subject, message } = validation.data;

  // Required by task: Gmail service
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    FROM_EMAIL,
    CONTACT_RECIPIENT_EMAIL,
    MAIL_TO,
    EMAIL_TO,
    RECIPIENT_EMAIL,
  } = process.env;

  // Recipient: use first available env var; no .env generation/changes.
  const to =
    normalizeString(CONTACT_RECIPIENT_EMAIL) ||
    normalizeString(MAIL_TO) ||
    normalizeString(EMAIL_TO) ||
    normalizeString(RECIPIENT_EMAIL);

  if (!to) {
    return res.status(500).json({
      success: false,
      message: "Missing contact recipient email in environment variables",
    });
  }

  const fromAddress = normalizeString(FROM_EMAIL) || normalizeString(SMTP_USER) || email;
  const fromLabel = fromAddress ? `L'ALLURE <${fromAddress}>` : undefined;

  // If SMTP credentials are missing, fail clearly.
  if (!SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      success: false,
      message: "Missing SMTP_USER/SMTP_PASS in environment variables",
    });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h3 style="margin:0 0 12px;">New Contact Message</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr/>
      <p style="white-space: pre-wrap;">${message}</p>
    </div>
  `;

  const text = `
New Contact Message

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
  `.trim();

  try {
    await transporter.sendMail({
      from: fromLabel || fromAddress,
      to,
      subject,
      replyTo: email, // required
      text,
      html,
    });

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (err) {
    console.error("[contact] sendMail failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: err?.message || String(err),
    });
  }
};

