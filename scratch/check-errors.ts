import { db } from "../src/database/db";

async function check() {
  try {
    const res = await db.query("SELECT id, ats, status, error_message, confirmation, created_at FROM applications ORDER BY created_at DESC LIMIT 10");
    console.table(res.rows);
  } catch (e: any) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
}

check();
