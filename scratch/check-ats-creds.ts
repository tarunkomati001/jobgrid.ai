import { db } from '../src/database/db';

async function main() {
  const r = await db.query("SELECT * FROM ats_credentials");
  console.log("ats_credentials:", r.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
