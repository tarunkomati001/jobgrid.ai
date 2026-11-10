import { db } from "../src/database/db";

async function main() {
  const res = await db.query("SELECT url, title, company, ats FROM jobs WHERE ats IN ('TALEO', 'ORACLE')");
  for (const r of res.rows) {
    console.log(`[${r.ats}] ${r.company} | ${r.title} | ${r.url}`);
  }
  process.exit(0);
}

main().catch(console.error);

