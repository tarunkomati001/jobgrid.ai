import { db } from "../src/database/db";

async function main() {
  const r = await db.query("SELECT * FROM resumes");
  console.log("Resumes:", r.rows);
  await db.close();
}

main().catch(console.error);

