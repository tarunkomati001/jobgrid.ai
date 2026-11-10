import { db } from "../src/database/db";

async function main() {
  const r = await db.query("SELECT id, url, title, company, ats FROM jobs WHERE url LIKE '%taleo%'");
  console.log("TALEO JOBS IN DB:", JSON.stringify(r.rows, null, 2));
  process.exit(0);
}

main().catch(console.error);

