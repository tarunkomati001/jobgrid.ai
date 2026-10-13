import { db } from '../src/database/db';

async function main() {
  const r = await db.query("SELECT id, title, company, url, ats FROM jobs WHERE ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%'");
  console.log("Found jobs:", JSON.stringify(r.rows, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
