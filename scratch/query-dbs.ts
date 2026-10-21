import { db } from "../src/database/db";

async function main() {
  console.log("Deleting non-Ashby jobs from database...");
  const res = await db.query("DELETE FROM jobs WHERE ats != 'ASHBY'");
  console.log("Deleted count:", res.rowCount);
  await db.close();
}

main().catch(console.error);
