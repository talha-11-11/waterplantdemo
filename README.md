# Water Plant Demo (PokitBio)

A demo of the water plant app (deliveries, billing and inventory), for showing to new customers.
It is a **separate app with its own database**, so nothing here can touch a real client's data.

## What the demo does
- **Logins:** `demo` / `demo123` (admin, shown on the login page with a "Fill in" button; its password can't be changed),
  and `pokitbio` (super admin, password from `SUPERADMIN_PASSWORD`).
- **Sample data:** 12 customers in 4 societies, about 45 days of deliveries up to yesterday, payments, dues and starting cans.
  It loads automatically on the first start.
- **Reset demo:** Settings → *Reset demo data* (or tap "Reset demo" on the yellow banner). Puts the sample data
  back with fresh dates. Do this before each customer meeting.
- **Rename for a prospect:** Settings → Business name (e.g. their shop name) and prices. Reset puts "Demo Water Plant" back.
- **WhatsApp:** customers have placeholder numbers, so *Deliver & WhatsApp* and bill *Send* open WhatsApp's chat
  picker. Send to yourself (or the prospect) to show the real message. No real customer is ever messaged.
- **Orders** (tab): open orders, **Due tomorrow**, + New, Done.
  - *Paste a WhatsApp message*: the app reads cans + date in Roman Urdu/English ("kal 3 can aur 1 dispenser")
    and finds the customer by phone or name. You check it, then save.
  - *Manual order* for phone calls etc.
  - Orders show on the route as a green badge with the cans pre-filled; delivering closes the order (Undo re-opens it).
  - *WhatsApp inbox (optional, automatic)*: messages to the business WhatsApp number become orders by themselves (see below).
- **Empty bottle record**: each delivery records "empty cans taken back" (defaults to the cans delivered).
  Cans each customer holds = starting cans + delivered − empties back. Shown on the route, the customer page and Stock.
- **Customer cycle / Deliver tomorrow**: the app learns each customer's usual gap between deliveries (and usual weekday),
  or uses "Delivers every N days" set on the customer. *Orders → Due tomorrow* lists orders + customers due by cycle,
  with *Add to tomorrow*, *Ask* (WhatsApp the customer) and *Send me this list on WhatsApp*. The route shows the count.
- **Camera production count (optional, off by default):** Settings → Optional features. Adds *Production* on the Stock page:
  take a photo of filled bottles, the phone counts them (TensorFlow.js COCO-SSD, runs on the phone, about 5 MB the first time),
  you check and save, and it's added to stock with today's production total. Typing the count also works.
- Everything else is the full app: route, optional dispenser cans, cash at the door, customers, payments,
  monthly bills with PDF + JazzCash logo, dashboard, backups & restore, PokitBio footer.

## Deploy (free, about 15 min)
1. **Database:** in Neon, create a **new project** called `water-plant-demo` (Singapore), choose "I just need a connection
   string", then **Connect**, turn pooling **OFF**, copy the string, and remove `&channel_binding=require` from the end.
2. **GitHub:** create a new private repo, `water-plant-demo`. Upload the *contents* of this folder (go inside the folder, select everything, drag it in).
3. **Render:** New → Blueprint → pick the repo. Enter `DATABASE_URL` (the demo database) and `SUPERADMIN_PASSWORD`.
4. Logs should show `Database ready`, `Created superadmin login: pokitbio`, `Created admin login: demo` and
   `Demo data loaded: 12 customers, … deliveries`.

## Optional: WhatsApp inbox (orders arrive automatically)
Needs a WhatsApp Business (Cloud API) number in Meta. Receiving messages is free.
1. Render → Environment: add `WA_VERIFY_TOKEN` (any text you choose) and `WA_APP_SECRET` (Meta app → Settings → Basic → App secret).
2. Meta app → WhatsApp → Configuration → Webhook: Callback URL `https://YOUR-APP.onrender.com/api/whatsapp/webhook`,
   Verify token = your `WA_VERIFY_TOKEN`, then subscribe to **messages**.
3. Customers' text messages now show in Orders with a "WhatsApp" badge. Messages are only accepted when signed by Meta.

## Local run
```bash
npm install
# .env: DATABASE_URL=..., SESSION_SECRET=any-long-text, NEXT_PUBLIC_DEMO_MODE=true, SUPERADMIN_PASSWORD=...
npm run build && npm start
```
