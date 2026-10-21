import { db } from "../src/database/db";

async function check() {
  try {
    const res = await db.query("SELECT * FROM application_events ORDER BY created_at DESC LIMIT 15");
    console.table(res.rows);
  } catch (e: any) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

check();
