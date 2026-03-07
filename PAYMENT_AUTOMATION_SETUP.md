# Payment Confirmation Email + Calendar Setup

## 1) Install and configure

1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Fill values for:
- `APP_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `HOTEL_EMAIL`
- `CALENDAR_TOKEN_SECRET`

## 2) Start server

- Run `npm start`

This serves the website and API routes from the same origin.

## 3) Stripe webhook

In Stripe dashboard, create webhook endpoint:
- URL: `https://your-domain.com/api/stripe-webhook`
- Events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`

Use the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.

## 4) Flow

- Guest clicks **Proceed to Stripe** on `payment.html`
- Server creates Checkout Session with booking metadata
- On paid event, webhook sends:
  - confirmation email to traveler
  - internal booking email to hotel
- Both emails include one smart **Add Booking To Calendar** link:
  - Google Calendar
  - iCal / Apple Calendar
  - Samsung Calendar (via `.ics` / `webcal`)

## Notes

- If API is unavailable, frontend falls back to configured static Stripe payment link.
- All displayed prices are treated as GST-inclusive in summaries.
