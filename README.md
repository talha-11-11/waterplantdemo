# Water Plant Demo (PokitBio)

A demo of the water delivery & billing app (the same app built for Pak Pure Pani), for showing to new customers.
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
- Everything else is the full app: route, optional dispenser cans, starting cans, cash at the door, customers, payments,
  monthly bills with PDF + JazzCash logo, dashboard, logins (super admin / admin), backups & restore, PokitBio footer.

## Deploy (free, about 15 min)
1. **Database:** in Neon, create a **new project** called `water-plant-demo` (Singapore), choose "I just need a connection
   string", then **Connect**, turn pooling **OFF**, copy the string, and remove `&channel_binding=require` from the end.
2. **GitHub:** create a new private repo, `water-plant-demo`. Upload the *contents* of this folder (go inside the folder, select everything, drag it in).
3. **Render:** New → Blueprint → pick the repo. Enter `DATABASE_URL` (the demo database) and `SUPERADMIN_PASSWORD`.
4. Logs should show `Database ready`, `Created superadmin login: pokitbio`, `Created admin login: demo` and
   `Demo data loaded: 12 customers, … deliveries`.

## Local run
```bash
npm install
# .env: DATABASE_URL=..., SESSION_SECRET=any-long-text, NEXT_PUBLIC_DEMO_MODE=true, SUPERADMIN_PASSWORD=...
npm run build && npm start
```
