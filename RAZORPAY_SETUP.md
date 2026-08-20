# Razorpay — what you have to do

The code is done. Everything below is account and dashboard work that only you
can do, because it needs your identity documents and your bank account.

Until `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set, the app behaves
exactly as it does today: the checkout shows the UPI QR and the reference form,
and you approve payments by hand from the admin panel. Nothing breaks while you
work through this list, so there is no rush and no flag day.

---

## 1. Sign up and finish KYC

<https://dashboard.razorpay.com/signup>

You need, at minimum:

- **PAN** — yours if you register as a sole proprietor, the company's if DATAD
  is incorporated
- **Bank account** in the same name as the PAN (settlements go here, and the
  name must match or activation stalls)
- **GSTIN** if you have one. You currently do not — `CheckoutSummary.jsx` says
  "DATAD is not GST-registered, so the listed price is the total." That is fine;
  Razorpay accepts a declaration instead.
- **Business website** with three pages live and linked in the footer. This is
  the step that blocks most people, and it is a website task, not a payments
  task:
  - Pricing — you have this at `/subscribe`
  - **Terms & Conditions**
  - **Refund / Cancellation policy**
  - **Contact us** with a real email and address

Sole-proprietor activation is usually 2–4 working days once documents are in.

## 2. Turn on the payment methods you actually want

Dashboard → Settings → Configuration → Payment Methods.

Enable **UPI** first — it is where nearly all of your volume will land and it
carries no MDR. Cards and netbanking are worth leaving on as a fallback. You can
leave EMI, Pay Later and international cards off; they add checkout clutter your
students will not use.

## 3. Generate API keys

Dashboard → Settings → API Keys → Generate Key.

You get a key id (`rzp_test_…` or `rzp_live_…`) and a secret shown **once**.
Copy the secret immediately — it cannot be retrieved later, only regenerated.

Start with **test mode** keys. The integration reports test mode to the client
and the checkout shows a "no real money will move" banner, so you can run the
whole flow safely.

## 4. Register the webhook

Dashboard → Settings → Webhooks → Add New Webhook.

- **URL:** `https://<your-domain>/api/subscription/webhook`
- **Secret:** invent a long random string — this is *not* your API key secret.
  ```bash
  openssl rand -hex 32
  ```
- **Active events:** `payment.captured` and `payment.failed`

The webhook is what makes activation reliable. The browser also confirms the
payment for instant access, but if a student's phone dies between paying and
returning to the app, the webhook is what still grants their plan.

For local testing, point the webhook at your ngrok tunnel.

## 5. Set the environment variables

On your host (Render/Railway) and in `server/.env` locally:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=<the random string from step 4>
```

Restart the server. The checkout switches to "Pay ₹X securely" on its own — the
client asks the server which gateway is live rather than being told at build
time, so there is no client rebuild and no `VITE_` variable to keep in sync.

## 6. Test before going live

With test keys:

1. Buy Pro monthly. Use test UPI id `success@razorpay`.
2. Confirm the plan activates immediately and the expiry is one month out.
3. Buy again while the plan is still running — the expiry must **extend**, not
   reset. (`nextExpiry` in `server/subscription/activation.js`.)
4. Pay with `failure@razorpay` and confirm nothing is granted.
5. Close the browser at the payment screen, then replay `payment.captured` from
   Dashboard → Webhooks → the event → Resend. The plan should activate anyway.
6. Check that the manual UPI fallback still works — "Pay by direct UPI transfer
   instead" under the pay button.

Then swap in live keys and buy one real ₹149 Pro plan yourself. Refund it from
the dashboard afterwards.

## 7. Ask Razorpay these two questions in writing

Before you build anything on top of recurring billing:

1. **What does a UPI Autopay mandate cost per debit?** Plain UPI collection is
   zero-MDR; recurring mandates have at times carried a separate charge. Your
   ₹149/month plan lives or dies on this number.
2. **What is your settlement cycle?** Default is T+2. Do not pay for instant
   settlement at your volume.

---

## What this integration does *not* do yet

**Auto-renewal.** Every purchase is still a one-off charge, so a student pays
₹149 and gets a month; they are not debited again automatically. This is
deliberate — Razorpay Subscriptions with UPI Autopay is a separate API and a
separate mandate flow, and it is not worth building until you know both the
per-debit cost (step 7) and whether students renew at all.

What you have now is the same shape as the manual flow, minus the 24-hour delay
and minus you approving anything. When renewals become the bottleneck, the
`SubscriptionRequest` → `activateSubscription` path is already the seam a
subscription webhook plugs into.

**Receipts and invoices.** The activation notification is in-app only. Razorpay
emails its own payment receipt if you enable it under Settings → Notifications.

**Refunds.** Issued from the Razorpay dashboard. The app will not know about it
— you also have to downgrade the user from the admin panel.
