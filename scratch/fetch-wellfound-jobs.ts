import { db } from "../src/database/db";

async function run() {
  try {
    const res = await db.query("SELECT id, title, company, url, ats FROM public.jobs WHERE ats = 'WELLFOUND' LIMIT 20");
    console.table(res.rows);
  } catch (e: any) {
    console.error("DB Error:", e.message);
  } finally {
    await db.close();
    process.exit(0);
  }
}

run();

