import { db } from '../src/database/db';

async function main() {
  const res = await db.query("DELETE FROM jobs WHERE url LIKE '%facebook.com%'");
  console.log("Deleted facebook rows:", res.rowCount);
  await db.close();
}

main().catch(console.error);
