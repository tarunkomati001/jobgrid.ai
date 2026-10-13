import { db } from "../src/database/db";

async function main() {
  const r = await db.query("SELECT id, url, title, company, ats FROM jobs WHERE ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%' LIMIT 20");
  console.log("Workday jobs count:", r.rows.length);
  for (const row of r.rows) {
    console.log(`- [${row.company}] ${row.title}: ${row.url}`);
  }
  process.exit(0);
}

main().catch(console.error);
