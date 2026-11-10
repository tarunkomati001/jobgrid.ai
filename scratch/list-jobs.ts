import { db } from "../src/database/db";

async function main() {
  const res = await db.query("SELECT url, company, title, ats FROM jobs ORDER BY ats ASC");
  for (const row of res.rows) {
    console.log(`[${row.ats}] ${row.company} - ${row.title}: ${row.url}`);
  }
  await db.close();
}

main().catch(console.error);
