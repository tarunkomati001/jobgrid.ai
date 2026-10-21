import { db } from "../src/database/db";

async function main() {
  const r = await db.query("SELECT id, title, url, ats FROM jobs WHERE ats = 'ORACLE' OR url LIKE '%careers.oracle.com%' OR url LIKE '%oraclecloud.com%'");
  console.log("DB count:", r.rows.length);
  console.log("DB rows:", r.rows);
  await db.close();
}

main().catch(console.error);
