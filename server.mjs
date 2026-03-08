import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const APP_BASE_URL = String(process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const CALENDAR_TOKEN_SECRET = process.env.CALENDAR_TOKEN_SECRET || 'replace-me-in-production';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const HOTEL_EMAIL = process.env.HOTEL_EMAIL || '';
const GUEST_EMAIL_LOGO_CID = 'omega-logo@omegaresidency';
const GUEST_EMAIL_LOGO_PATH = path.join(__dirname, 'Images', 'OMEGA_LOGO-removebg.png');
const hasGuestLogo = fs.existsSync(GUEST_EMAIL_LOGO_PATH);

const razorpayReady = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

const smtpReady = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  EMAIL_FROM
);

const mailer = smtpReady
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
  : null;

const verifiedPayments = new Set();
const pendingOrders = new Map();
const paymentConfirmations = new Map();

const cleanText = (value, max = 240) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanMultiline = (value, max = 500) => String(value || '').replace(/\r/g, '').trim().slice(0, max);

const toPositiveInt = (value, fallback = 0) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeBookingPayload = (raw) => {
  const nowIso = new Date().toISOString().slice(0, 10);
  const checkin = isIsoDate(raw.checkin) ? String(raw.checkin) : nowIso;
  let checkout = isIsoDate(raw.checkout) ? String(raw.checkout) : addDays(checkin, 1);
  if (checkout <= checkin) checkout = addDays(checkin, 1);

  const totalInr = toPositiveInt(raw.totalInr, 0);
  const nights = Math.max(1, toPositiveInt(raw.nights, 1));

  return {
    bookingRef: cleanText(raw.bookingRef || `BK-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`, 40),
    guestName: cleanText(raw.guestName || 'Guest', 120),
    guestEmail: cleanText(raw.guestEmail || '', 200),
    guestPhone: cleanText(raw.guestPhone || '', 40),
    room: cleanText(raw.room || 'Room', 120),
    plan: cleanText(raw.plan || 'EP (Room only)', 120),
    checkin,
    checkout,
    guests: Math.max(1, toPositiveInt(raw.guests, 1)),
    nights,
    baseRateInr: toPositiveInt(raw.baseRateInr, totalInr),
    addonsInr: toPositiveInt(raw.addonsInr, 0),
    totalInr,
    addonsText: cleanText(raw.addonsText || 'None', 200),
    specialRequest: cleanMultiline(raw.specialRequest || '-', 500)
  };
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toDisplayDate = (iso) => {
  if (!isIsoDate(iso)) return '-';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const toIcsDate = (iso) => String(iso).replace(/-/g, '');
const toGoogleDate = (iso) => String(iso).replace(/-/g, '');

const escapeIcsText = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

const utcStamp = () => {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
};

const signCalendarToken = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', CALENDAR_TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
};

const verifyCalendarToken = (token) => {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) throw new Error('Malformed token');
  const expected = crypto.createHmac('sha256', CALENDAR_TOKEN_SECRET).update(encoded).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid token signature');
  }
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
};

const getCalendarLinks = (booking) => {
  const token = signCalendarToken({
    bookingRef: booking.bookingRef,
    guestName: booking.guestName,
    room: booking.room,
    plan: booking.plan,
    checkin: booking.checkin,
    checkout: booking.checkout,
    guests: booking.guests
  });

  const smartUrl = `${APP_BASE_URL}/calendar/add/${token}`;
  const icsUrl = `${APP_BASE_URL}/calendar/ics/${token}`;
  const icsWebcalUrl = icsUrl.replace(/^https?:\/\//, 'webcal://');

  const details = [
    `Booking Ref: ${booking.bookingRef}`,
    `Room: ${booking.room}`,
    `Meal Plan: ${booking.plan}`,
    `Guests: ${booking.guests}`,
    'Hotel: Omega Residency, Darjeeling'
  ].join('\n');

  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Stay at Omega Residency (${booking.bookingRef})`,
    dates: `${toGoogleDate(booking.checkin)}/${toGoogleDate(booking.checkout)}`,
    details,
    location: 'Omega Residency, HD Lama Road, near Mall Road, Darjeeling'
  });

  return {
    token,
    smartUrl,
    icsUrl,
    icsWebcalUrl,
    googleUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`
  };
};

const buildIcsFile = (booking) => {
  const uid = `${booking.bookingRef}-${crypto.randomBytes(4).toString('hex')}@omegaresidency`;
  const description = [
    `Booking Ref: ${booking.bookingRef}`,
    `Guest: ${booking.guestName}`,
    `Room: ${booking.room}`,
    `Meal Plan: ${booking.plan}`,
    `Guests: ${booking.guests}`
  ].join('\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Omega Residency//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART;VALUE=DATE:${toIcsDate(booking.checkin)}`,
    `DTEND;VALUE=DATE:${toIcsDate(booking.checkout)}`,
    `SUMMARY:${escapeIcsText(`Omega Residency Stay (${booking.bookingRef})`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText('Omega Residency, HD Lama Road, Darjeeling')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
};

const bookingTableRows = (booking) => `
  <tr><td style="padding:8px 0;color:#6b574a;">Booking Ref</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(booking.bookingRef)}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Guest</td><td style="padding:8px 0;text-align:right;">${escapeHtml(booking.guestName)}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Stay</td><td style="padding:8px 0;text-align:right;">${escapeHtml(toDisplayDate(booking.checkin))} to ${escapeHtml(toDisplayDate(booking.checkout))}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Room</td><td style="padding:8px 0;text-align:right;">${escapeHtml(booking.room)}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Meal Plan</td><td style="padding:8px 0;text-align:right;">${escapeHtml(booking.plan)}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Guests</td><td style="padding:8px 0;text-align:right;">${escapeHtml(String(booking.guests))}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Nights</td><td style="padding:8px 0;text-align:right;">${escapeHtml(String(booking.nights))}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Base Rate</td><td style="padding:8px 0;text-align:right;">₹${escapeHtml(String(booking.baseRateInr))}</td></tr>
  <tr><td style="padding:8px 0;color:#6b574a;">Add-ons</td><td style="padding:8px 0;text-align:right;">₹${escapeHtml(String(booking.addonsInr))} (${escapeHtml(booking.addonsText)})</td></tr>
  <tr><td style="padding:10px 0 0;font-size:20px;font-weight:700;">Total</td><td style="padding:10px 0 0;text-align:right;font-size:24px;font-weight:800;">₹${escapeHtml(String(booking.totalInr))}</td></tr>
`;

const buildGuestEmailHtml = (booking, calendarLinks) => `
  <div style="font-family:Segoe UI,Tahoma,sans-serif;background:#f7f1e7;padding:28px;color:#2d221b;">
    <div style="max-width:660px;margin:0 auto;background:#fffaf2;border:1px solid #e8dbc8;border-radius:22px;overflow:hidden;box-shadow:0 18px 36px rgba(61,38,20,.12);">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#8b5e3c,#70492d);color:#fff;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:78px;vertical-align:middle;">
              ${hasGuestLogo
    ? `<img src="cid:${escapeHtml(GUEST_EMAIL_LOGO_CID)}" alt="Omega Residency logo" width="66" height="66" style="display:block;border-radius:12px;background:#f6eee2;padding:4px;" />`
    : `<div style="width:66px;height:66px;border-radius:12px;background:#f6eee2;color:#70492d;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;">OR</div>`
}
            </td>
            <td style="vertical-align:middle;">
              <h1 style="margin:0;font-size:30px;line-height:1.15;">Booking Confirmed</h1>
              <p style="margin:7px 0 0;opacity:.95;font-size:17px;">Omega Residency, Darjeeling</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 14px;font-size:17px;line-height:1.5;">
          Hi ${escapeHtml(booking.guestName || 'Guest')}, your payment has been received and your stay is confirmed.
        </p>
        <table style="width:100%;border-collapse:collapse;">${bookingTableRows(booking)}</table>
        <p style="margin:16px 0 0;color:#6b574a;font-size:13px;">All displayed prices are inclusive of GST.</p>

        <div style="margin-top:20px;padding:14px 16px;border:1px solid #e5d4bf;border-radius:14px;background:#fbf4e9;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#3f2b1f;">Cancellation Policy</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#6b574a;">Free cancellation up to 3 days before check-in. After that, a 1-night charge may apply.</p>
        </div>

        <div style="margin-top:16px;padding:14px 16px;border:1px solid #e5d4bf;border-radius:14px;background:#fffdf9;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#3f2b1f;">Need help or have any concerns?</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#6b574a;">
            Call or WhatsApp: <a href="tel:+918509307438" style="color:#8b5e3c;text-decoration:none;font-weight:700;">+91 85093 07438</a><br />
            Landline: <a href="tel:+913542254990" style="color:#8b5e3c;text-decoration:none;font-weight:700;">0354 2254990</a>
          </p>
        </div>

        <div style="margin-top:22px;text-align:center;">
          <a href="${escapeHtml(calendarLinks.smartUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#8b5e3c;color:#fff;text-decoration:none;font-weight:700;">Add Booking To Calendar</a>
        </div>
        <p style="margin-top:14px;color:#6b574a;font-size:13px;line-height:1.5;text-align:center;">One link supports Google Calendar, iCal (Apple), and Samsung Calendar.</p>

        <p style="margin:20px 0 0;font-size:16px;line-height:1.6;color:#3f2b1f;font-weight:600;">Looking forward for your stay with us.</p>
      </div>
    </div>
  </div>
`;

const buildHotelEmailHtml = (booking, calendarLinks) => `
  <div style="font-family:Segoe UI,Tahoma,sans-serif;background:#f7f1e7;padding:28px;color:#2d221b;">
    <div style="max-width:640px;margin:0 auto;background:#fffaf2;border:1px solid #e8dbc8;border-radius:20px;overflow:hidden;">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#3f2b1f,#2d221b);color:#fff;">
        <h1 style="margin:0;font-size:28px;line-height:1.2;">New Paid Booking</h1>
        <p style="margin:10px 0 0;opacity:.95;">Omega Residency, Darjeeling</p>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 12px;font-size:16px;">A guest has completed payment for booking reference <strong>${escapeHtml(booking.bookingRef)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;">${bookingTableRows(booking)}</table>
        <p style="margin:14px 0 0;color:#6b574a;font-size:14px;">Guest Contact: ${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone || '-')}</p>
        <p style="margin:8px 0 0;color:#6b574a;font-size:14px;">Special Request: ${escapeHtml(booking.specialRequest || '-')}</p>
        <div style="margin-top:22px;text-align:center;">
          <a href="${escapeHtml(calendarLinks.smartUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#3f2b1f;color:#fff;text-decoration:none;font-weight:700;">Open Calendar Link</a>
        </div>
      </div>
    </div>
  </div>
`;

const sendBookingEmails = async (booking, calendarLinks) => {
  if (!mailer) {
    console.warn('SMTP not configured. Skipping confirmation emails.');
    return;
  }

  const travelerTo = booking.guestEmail;
  const hotelTo = HOTEL_EMAIL;
  const guestAttachments = hasGuestLogo
    ? [{
      filename: 'OMEGA_LOGO-removebg.png',
      path: GUEST_EMAIL_LOGO_PATH,
      cid: GUEST_EMAIL_LOGO_CID
    }]
    : [];

  if (travelerTo) {
    await mailer.sendMail({
      from: EMAIL_FROM,
      to: travelerTo,
      subject: `Booking Confirmed • ${booking.bookingRef} • Omega Residency`,
      html: buildGuestEmailHtml(booking, calendarLinks),
      attachments: guestAttachments,
      text:
        `Booking confirmed: ${booking.bookingRef}\n` +
        `Room: ${booking.room}\n` +
        `Plan: ${booking.plan}\n` +
        `Stay: ${booking.checkin} to ${booking.checkout}\n` +
        `Total: ₹${booking.totalInr}\n` +
        `All displayed prices are inclusive of GST.\n` +
        `Cancellation: Free cancellation up to 3 days before check-in. After that, a 1-night charge may apply.\n` +
        `Concerns? Call/WhatsApp +91 85093 07438 | Landline 0354 2254990\n` +
        `Add to Calendar: ${calendarLinks.smartUrl}\n` +
        `Looking forward for your stay with us.`
    });
  }

  if (hotelTo) {
    await mailer.sendMail({
      from: EMAIL_FROM,
      to: hotelTo,
      subject: `New Paid Booking • ${booking.bookingRef}`,
      html: buildHotelEmailHtml(booking, calendarLinks),
      text:
        `New paid booking: ${booking.bookingRef}\n` +
        `Guest: ${booking.guestName}\n` +
        `Email: ${booking.guestEmail}\n` +
        `Phone: ${booking.guestPhone}\n` +
        `Room: ${booking.room}\n` +
        `Plan: ${booking.plan}\n` +
        `Stay: ${booking.checkin} to ${booking.checkout}\n` +
        `Total: ₹${booking.totalInr}\n` +
        `Add to Calendar: ${calendarLinks.smartUrl}`
    });
  }
};

const toConfirmationPayload = (booking, calendarLinks) => ({
  bookingRef: booking.bookingRef,
  guestName: booking.guestName,
  room: booking.room,
  plan: booking.plan,
  checkin: booking.checkin,
  checkout: booking.checkout,
  totalInr: booking.totalInr,
  calendarUrl: calendarLinks.smartUrl
});

app.use(express.json({ limit: '1mb' }));

const safeEqual = (a, b) => {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const razorpayAuthHeader = () =>
  `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;

const razorpayRequest = async (endpoint, method = 'GET', payload = null) => {
  const response = await fetch(`https://api.razorpay.com/v1/${endpoint}`, {
    method,
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data && data.error && data.error.description) ||
      (data && data.error && data.error.reason) ||
      'Razorpay API request failed.';
    throw new Error(message);
  }
  return data;
};

const storePendingOrder = (orderId, booking) => {
  pendingOrders.set(orderId, { booking, createdAt: Date.now() });
  if (pendingOrders.size > 500) {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    Array.from(pendingOrders.entries()).forEach(([id, entry]) => {
      if (!entry || !entry.createdAt || entry.createdAt < cutoff) pendingOrders.delete(id);
    });
  }
};

const getPendingOrderBooking = (orderId) => {
  const entry = pendingOrders.get(orderId);
  if (!entry) return null;
  const staleMs = 24 * 60 * 60 * 1000;
  if ((Date.now() - entry.createdAt) > staleMs) {
    pendingOrders.delete(orderId);
    return null;
  }
  return entry.booking;
};

app.post('/api/create-razorpay-order', async (req, res) => {
  if (!razorpayReady) return res.status(503).json({ error: 'Razorpay server is not configured.' });

  const booking = normalizeBookingPayload(req.body || {});
  if (!booking.guestEmail) {
    return res.status(400).json({ error: 'Guest email is required to send confirmation.' });
  }
  if (booking.totalInr < 1) {
    return res.status(400).json({ error: 'Invalid total amount.' });
  }

  const amountInPaise = booking.totalInr * 100;
  const receipt = cleanText(booking.bookingRef, 40).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `BK${Date.now()}`;

  try {
    const order = await razorpayRequest('orders', 'POST', {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        booking_ref: cleanText(booking.bookingRef, 40),
        room: cleanText(booking.room, 80),
        plan: cleanText(booking.plan, 80),
        checkin: booking.checkin,
        checkout: booking.checkout
      }
    });

    if (!order || !order.id) throw new Error('Invalid Razorpay order response.');
    storePendingOrder(order.id, booking);

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || 'INR',
      bookingRef: booking.bookingRef,
      name: 'Omega Residency',
      description: `${booking.room} · ${booking.plan}`,
      prefill: {
        name: booking.guestName || 'Guest',
        email: booking.guestEmail || '',
        contact: booking.guestPhone || ''
      }
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    return res.status(500).json({ error: err && err.message ? err.message : 'Failed to create Razorpay order.' });
  }
});

app.post('/api/razorpay/verify-payment', async (req, res) => {
  if (!razorpayReady) return res.status(503).json({ error: 'Razorpay server is not configured.' });

  const orderId = cleanText(req.body && req.body.razorpay_order_id, 120);
  const paymentId = cleanText(req.body && req.body.razorpay_payment_id, 120);
  const signature = cleanText(req.body && req.body.razorpay_signature, 160);

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Missing Razorpay verification fields.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (!safeEqual(signature, expectedSignature)) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }

  if (paymentConfirmations.has(paymentId)) {
    return res.json(paymentConfirmations.get(paymentId));
  }

  const booking = getPendingOrderBooking(orderId);
  if (!booking) {
    return res.status(400).json({ error: 'Booking draft for this order was not found. Please contact the hotel.' });
  }

  try {
    const payment = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}`, 'GET');
    const paymentStatus = String(payment.status || '').toLowerCase();
    const paidStates = new Set(['authorized', 'captured']);

    if (!paidStates.has(paymentStatus)) {
      return res.status(400).json({ error: 'Payment is not yet authorized.' });
    }
    if (String(payment.order_id || '') !== orderId) {
      return res.status(400).json({ error: 'Payment order mismatch.' });
    }
    if (toPositiveInt(payment.amount, 0) !== booking.totalInr * 100) {
      return res.status(400).json({ error: 'Payment amount mismatch.' });
    }

    if (!verifiedPayments.has(paymentId)) {
      verifiedPayments.add(paymentId);
      const calendarLinks = getCalendarLinks(booking);
      await sendBookingEmails(booking, calendarLinks);
      const confirmation = {
        ...toConfirmationPayload(booking, calendarLinks),
        paymentId
      };
      paymentConfirmations.set(paymentId, confirmation);
      pendingOrders.delete(orderId);
      return res.json(confirmation);
    }

    const calendarLinks = getCalendarLinks(booking);
    const confirmation = {
      ...toConfirmationPayload(booking, calendarLinks),
      paymentId
    };
    paymentConfirmations.set(paymentId, confirmation);
    return res.json(confirmation);
  } catch (err) {
    console.error('Razorpay verification failed:', err);
    return res.status(500).json({ error: err && err.message ? err.message : 'Failed to verify payment.' });
  }
});

app.get('/api/razorpay/confirmation', (req, res) => {
  const paymentId = cleanText(req.query.payment_id || '', 120);
  if (!paymentId) return res.status(400).json({ error: 'payment_id is required.' });
  const confirmation = paymentConfirmations.get(paymentId);
  if (!confirmation) return res.status(404).json({ error: 'Confirmation not found.' });
  return res.json(confirmation);
});

app.get('/calendar/add/:token', (req, res) => {
  try {
    const booking = verifyCalendarToken(req.params.token);
    const links = getCalendarLinks(booking);
    const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Add Booking To Calendar</title>
  <style>
    body{margin:0;font-family:Segoe UI,Tahoma,sans-serif;background:#f6efe2;color:#2d221b}
    .shell{max-width:720px;margin:3rem auto;padding:1rem}
    .card{background:#fffaf2;border:1px solid #e9dcc8;border-radius:22px;box-shadow:0 20px 45px rgba(53,34,21,.1);overflow:hidden}
    .head{padding:1.2rem 1.3rem;background:linear-gradient(140deg,#8b5e3c,#70492d);color:#fff}
    .body{padding:1.3rem}
    .btn{display:block;text-align:center;margin:.7rem 0;padding:.85rem 1rem;border-radius:999px;text-decoration:none;font-weight:700}
    .btn-primary{background:#8b5e3c;color:#fff}
    .btn-secondary{background:#efe1ce;color:#3f2b1f}
    .meta{color:#6b574a;font-size:.95rem}
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <div class="head">
        <h1 style="margin:0;font-size:1.55rem;">Add Booking To Calendar</h1>
      </div>
      <div class="body">
        <p style="margin-top:0;">Booking <strong>${escapeHtml(booking.bookingRef || '-')}</strong> · ${escapeHtml(booking.room || 'Room')}</p>
        <p class="meta">Use one of the options below depending on your calendar app.</p>
        <a class="btn btn-primary" href="${escapeHtml(links.googleUrl)}">Add To Google Calendar</a>
        <a class="btn btn-secondary" href="${escapeHtml(links.icsUrl)}">Add To iCal / Samsung Calendar (.ics)</a>
        <a class="btn btn-secondary" href="${escapeHtml(links.icsWebcalUrl)}">Subscribe via webcal://</a>
      </div>
    </div>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(page);
  } catch {
    return res.status(400).send('Invalid calendar link.');
  }
});

app.get('/calendar/ics/:token', (req, res) => {
  try {
    const booking = verifyCalendarToken(req.params.token);
    const ics = buildIcsFile(booking);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="omega-residency-booking.ics"');
    return res.send(ics);
  } catch {
    return res.status(400).send('Invalid calendar token.');
  }
});

app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    razorpayConfigured: razorpayReady,
    smtpConfigured: Boolean(mailer),
    appBaseUrl: APP_BASE_URL
  });
});

app.listen(PORT, () => {
  console.log(`Omega server running on ${APP_BASE_URL}`);
});
