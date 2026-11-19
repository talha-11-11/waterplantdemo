// Demo data: wipes all business data and fills realistic sample data with dates
// relative to today, so the demo always looks "live". Logins are not touched.
// Used on first start (empty database) and by the "Reset demo data" button.

export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "demo123";
export const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// name, society, address, usual standard, usual dispenser, starting cans
const PEOPLE = [
  ["Ahmed Raza", "Citi Housing", "A-Block, House 112", 2, 0, 3],
  ["Bilal Khan", "Citi Housing", "B-Block, House 45", 1, 0, 2],
  ["Sana Iqbal", "Citi Housing", "C-Block, House 210", 0, 1, 1],
  ["Kashif Mehmood", "Citi Housing", "D-Block, House 8", 3, 0, 4],
  ["Usman Tariq", "Green Valley", "Street 4, House 18", 2, 0, 3],
  ["Farah Naz", "Green Valley", "Street 7, House 33", 1, 1, 3],
  ["Zubair Ahmad", "Green Valley", "Street 2, House 5", 2, 0, 2],
  ["Hamza Ali", "Chenab Gardens", "D-Block, House 9", 3, 1, 5],
  ["Nadia Shah", "Chenab Gardens", "A-Block, House 61", 0, 1, 1],
  ["Imran Butt", "Chenab Gardens", "C-Block, House 27", 2, 0, 3],
  ["Ayesha Malik", "Model Town", "Street 12, House 3", 1, 0, 2],
  ["Rizwan Haider", "Model Town", "Street 15, House 40", 2, 1, 4],
];

export async function seedDemo(pool) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const t of ["production_logs", "orders", "inventory_moves", "inventory_items", "message_log", "bills", "payments", "deliveries", "customers", "backups"]) {
      await client.query(`delete from ${t}`);
    }
    for (const t of ["customers", "deliveries", "payments", "bills", "inventory_items", "inventory_moves", "orders", "production_logs"]) {
      await client.query(`select setval(pg_get_serial_sequence('${t}','id'), 1, false)`);
    }
    await client.query(`
      insert into settings (id, business_name, price_std, price_disp, payment_info, owner_phone,
        jazzcash_number, jazzcash_title, easypaisa_number, easypaisa_title, camera_production)
      values (1, 'Demo Water Plant', 60, 150, '', '', '0300-0000000', 'Demo Owner', '', '', false)
      on conflict (id) do update set business_name = excluded.business_name, price_std = 60, price_disp = 150,
        payment_info = '', owner_phone = '', jazzcash_number = excluded.jazzcash_number,
        jazzcash_title = excluded.jazzcash_title, easypaisa_number = '', easypaisa_title = '', camera_production = false`);

    const ids = [];
    for (let i = 0; i < PEOPLE.length; i++) {
      const [name, society, address, std, disp, start] = PEOPLE[i];
      const phone = `9230000000${String(i + 10).padStart(2, "0")}`; // placeholder numbers, never messaged in demo
      const { rows } = await client.query(
        `insert into customers (name, phone, society, address, default_std, default_disp, starting_cans)
         values ($1,$2,$3,$4,$5,$6,$7) returning id, default_std, default_disp`,
        [name, phone, society, address, std, disp, start],
      );
      ids.push(rows[0]);
    }

    // ~45 days of deliveries following each customer's own rhythm (every 1–7 days), up to yesterday.
    // A couple of customers keep an empty can now and then, so "cans held" changes.
    const t = today();
    let seed = 11;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const CYCLE = [2, 3, 2, 1, 3, 4, 7, 2, 3, 2, 7, 3];
    const KEEPS = new Set([1, 7]); // sometimes don't return an empty
    const values = [];
    ids.forEach((c, i) => {
      const every = CYCLE[i % CYCLE.length];
      // Next due in 1–5 days, so only a few are due tomorrow (like a real day)
      const NEXT = [1, 2, 1, 1, 3, 2, 4, 1, 2, 3, 5, 2];
      let d = addDays(t, NEXT[i % NEXT.length] - every);
      while (d >= t) d = addDays(d, -every);
      while (d > addDays(t, -45)) {
        const std = c.default_std + (rnd() < 0.12 ? 1 : 0);
        const disp = c.default_disp;
        if (std + disp > 0) {
          const empties = KEEPS.has(i) && rnd() < 0.25 ? Math.max(0, std + disp - 1) : null;
          values.push([c.id, d, std, disp, 60, 150, std * 60 + disp * 150, empties]);
        }
        const jitter = rnd() < 0.15 ? 1 : 0; // the odd day late
        d = addDays(d, -(every + jitter));
      }
    });
    for (let i = 0; i < values.length; i += 300) {
      const part = values.slice(i, i + 300);
      const params = part.flat();
      const rows = part.map((_, j) => `(${Array.from({ length: 8 }, (_, k) => `$${j * 8 + k + 1}`).join(",")})`).join(",");
      await client.query(`insert into deliveries (customer_id, date, std, disp, price_std, price_disp, amount, empties_returned) values ${rows}`, params);
    }

    // Payments: most customers paid something, a few still owe
    const pays = [
      [0, -30, 3000, "cash"], [1, -25, 1200, "jazzcash"], [3, -20, 4500, "cash"], [4, -18, 2000, "cash"],
      [5, -12, 3000, "jazzcash"], [7, -28, 6000, "cash"], [9, -15, 2500, "cash"], [10, -8, 1500, "jazzcash"],
      [0, -3, 1200, "cash"], [6, -6, 2400, "cash"],
    ];
    for (const [i, days, amount, method] of pays) {
      await client.query("insert into payments (customer_id, date, amount, method) values ($1,$2,$3,$4)",
        [ids[i].id, addDays(t, days), amount, method]);
    }
    // Inventory: filled cans go down with deliveries; the rest are entered by hand
    const start = addDays(t, -14);
    const items = [
      // name, unit, lowAt, linkedTo, moves [daysAgo, qty, kind, note]
      ["Filled standard cans (19L)", "cans", 40, "std", [[14, 120, "count", "Opening stock"], [10, 60, "in", "Filled at plant"], [6, 60, "in", "Filled at plant"], [2, 50, "in", "Filled at plant"]]],
      ["Filled dispenser cans", "cans", 15, "disp", [[14, 30, "count", "Opening stock"], [8, 20, "in", "Filled at plant"], [3, 10, "in", "Filled at plant"]]],
      ["Empty cans (spare)", "cans", 20, "", [[14, 80, "count", "Opening stock"], [9, -6, "out", "Given to new customers"], [4, -2, "out", "Damaged"]]],
      ["Caps", "pcs", 300, "", [[14, 2000, "count", "Opening stock"], [7, -900, "out", "Used"], [1, -850, "out", "Used"]]],
      ["Seals / shrink sleeves", "pcs", 300, "", [[14, 1500, "count", "Opening stock"], [7, -700, "out", "Used"]]],
      ["Filter cartridges", "pcs", 2, "", [[14, 6, "count", "Opening stock"], [5, -2, "out", "Changed"]]],
      ["Chlorine", "kg", 5, "", [[14, 25, "count", "Opening stock"], [7, -6, "out", "Used"], [2, -5, "out", "Used"]]],
    ];
    for (const [name, unit, lowAt, linkedTo, moves] of items) {
      const { rows } = await client.query(
        "insert into inventory_items (name, unit, low_at, linked_to, track_from) values ($1,$2,$3,$4,$5) returning id",
        [name, unit, lowAt, linkedTo, start]);
      for (const [ago, qty, kind, note] of moves) {
        await client.query("insert into inventory_moves (item_id, date, qty, kind, note, created_by) values ($1,$2,$3,$4,$5,'demo')",
          [rows[0].id, addDays(t, -ago), qty, kind, note]);
      }
    }
    // Orders: from WhatsApp (inbox + pasted), by hand, one from an unknown number, a few already done
    const order = (i, days, std, disp, source, raw, status = "open", note = "") =>
      client.query(`insert into orders (customer_id, from_name, from_phone, date, std, disp, source, raw_text, status, note, created_by, done_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'demo',$11)`,
        [i == null ? null : ids[i].id, i == null ? "Waqas (new)" : "", i == null ? "923211234567" : "", addDays(t, days), std, disp, source, raw, status, note,
         status === "open" ? null : new Date()]);
    await order(4, 0, 3, 0, "whatsapp", "Assalam o alaikum aaj 3 can bhej dein");
    await order(8, 0, 0, 2, "paste", "bhai 2 dispenser chahiye aaj");
    await order(2, 1, 0, 1, "whatsapp", "kal ek dispenser bottle");
    await order(10, 1, 2, 0, "manual", "", "open", "Phone call, after 5 pm");
    await order(null, 0, 4, 0, "whatsapp", "Salam, Green Valley street 9 mein 4 can chahiye");
    await order(0, -2, 2, 0, "whatsapp", "2 can kal", "delivered");
    await order(5, -1, 1, 1, "manual", "", "cancelled", "Customer out of town");

    // Production log (for the optional camera feature)
    const std = (await client.query("select id from inventory_items where linked_to = 'std' limit 1")).rows[0]?.id ?? null;
    for (const [ago, count, method, detected] of [[2, 48, "camera", 46], [2, 30, "manual", null], [1, 52, "camera", 52], [0, 24, "camera", 25]]) {
      await client.query("insert into production_logs (date, count, method, detected, item_id, created_by) values ($1,$2,$3,$4,$5,'demo')",
        [addDays(t, -ago), count, method, detected, std]);
    }

    await client.query("commit");
    return { customers: ids.length, deliveries: values.length };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
