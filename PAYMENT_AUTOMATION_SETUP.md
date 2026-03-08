# Payment Confirmation Email + Calendar Setup

## 1) Backend setup (Render / Railway / VPS)

1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Fill values for:
- `APP_BASE_URL`
- `ALLOWED_ORIGINS` (your GitHub Pages origin, comma-separated if multiple)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `HOTEL_EMAIL`
- `CALENDAR_TOKEN_SECRET`

## 2) Start backend

- Run `npm start`
- Open the site using `http://localhost:3000` (do not use `file://.../payment.html`)

For production, deploy this Node server and note your backend URL (example: `https://omega-api.onrender.com`).

## 3) Frontend config (GitHub Pages)

Edit `config.js`:
- `window.OMEGA_CONFIG.API_BASE_URL = "https://your-backend-domain.com";`

Keep it empty only for same-origin local mode.

## 4) Flow

- Guest clicks **Proceed to Pay** on `payment.html`
- Server creates Razorpay Order with booking details
- Razorpay Checkout popup opens on the payment page
- On successful payment, server verifies Razorpay signature and payment amount
- After verification, server sends:
  - confirmation email to traveler
  - internal booking email to hotel
- Both emails include one smart **Add Booking To Calendar** link:
  - Google Calendar
  - iCal / Apple Calendar
  - Samsung Calendar (via `.ics` / `webcal`)

## Notes

- All displayed prices are treated as GST-inclusive in summaries.
- If `Failed to create payment order` appears on GitHub Pages, check:
  - backend is deployed and running
  - `config.js` API base URL is correct
  - backend `ALLOWED_ORIGINS` includes your GitHub Pages domain
