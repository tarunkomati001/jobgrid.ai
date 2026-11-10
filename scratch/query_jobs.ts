import { db } from "../src/database/db";

async function main() {
  try {
    const res = await db.query("SELECT id, url, ats, title, company FROM jobs WHERE ats IN ('TALEO', 'ORACLE') OR url ILIKE '%taleo%' OR url ILIKE '%oraclecloud%' OR url ILIKE '%oracle.com%'");
    console.log("Jobs found:", JSON.stringify(res.rows, null, 2));
  } catch (err: any) {
    console.error("DB Error:", err.message);
  } finally {
    await db.end();
  }
}

main();

