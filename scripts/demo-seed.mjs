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
    for (const t of ["message_log", "bills", "payments", "deliveries", "customers", "backups"]) {
      await client.query(`delete from ${t}`);
    }
    for (const t of ["customers", "deliveries", "payments", "bills"]) {
      await client.query(`select setval(pg_get_serial_sequence('${t}','id'), 1, false)`);
    }
    await client.query(`
      insert into settings (id, business_name, price_std, price_disp, payment_info, owner_phone,
        jazzcash_number, jazzcash_title, easypaisa_number, easypaisa_title)
      values (1, 'Demo Water Plant', 60, 150, '', '', '0300-0000000', 'Demo Owner', '', '')
      on conflict (id) do update set business_name = excluded.business_name, price_std = 60, price_disp = 150,
        payment_info = '', owner_phone = '', jazzcash_number = excluded.jazzcash_number,
        jazzcash_title = excluded.jazzcash_title, easypaisa_number = '', easypaisa_title = ''`);

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

    // ~45 days of deliveries (not every house every day), up to yesterday
    const t = today();
    let seed = 11;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const values = [];
    for (let d = addDays(t, -45); d < t; d = addDays(d, 1)) {
      for (const c of ids) {
        if (rnd() < 0.4) continue;
        const std = c.default_std + (rnd() < 0.15 ? 1 : 0);
        const disp = c.default_disp;
        if (std + disp === 0) continue;
        values.push([c.id, d, std, disp, 60, 150, std * 60 + disp * 150]);
      }
    }
    for (let i = 0; i < values.length; i += 300) {
      const part = values.slice(i, i + 300);
      const params = part.flat();
      const rows = part.map((_, j) => `(${Array.from({ length: 7 }, (_, k) => `$${j * 7 + k + 1}`).join(",")})`).join(",");
      await client.query(`insert into deliveries (customer_id, date, std, disp, price_std, price_disp, amount) values ${rows}`, params);
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
    await client.query("commit");
    return { customers: ids.length, deliveries: values.length };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
