# Payment Confirmation Email + Calendar Setup

## 1) Install and configure

1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Fill values for:
- `APP_BASE_URL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `HOTEL_EMAIL`
- `CALENDAR_TOKEN_SECRET`

## 2) Start server

- Run `npm start`
- Open the site using `http://localhost:3000` (do not use `file://.../payment.html`)

This serves the website and API routes from the same origin.

## 3) Flow

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
