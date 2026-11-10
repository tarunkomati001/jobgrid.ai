import { db } from "../src/database/db";

async function run() {
  const lever = await db.query("SELECT id, title, company, url FROM jobs WHERE ats = 'LEVER' LIMIT 5");
  console.log("LEVER JOBS:\n", JSON.stringify(lever.rows, null, 2));

  const gh = await db.query("SELECT id, title, company, url FROM jobs WHERE ats = 'GREENHOUSE' LIMIT 5");
  console.log("GREENHOUSE JOBS:\n", JSON.stringify(gh.rows, null, 2));
  process.exit(0);
}

run();

