import { db } from "../src/database/db";

async function main() {
  const res = await db.query("SELECT url, title, company FROM jobs WHERE ats = 'ASHBY'");
  console.log("ASHBY JOBS IN DB:");
  for (const r of res.rows) {
    console.log(`${r.company}: ${r.title} -> ${r.url}`);
  }
  process.exit(0);
}

main().catch(console.error);

