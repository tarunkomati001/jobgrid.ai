import { db } from "../src/database/db";

async function main() {
  const jobs = await db.query(
    "SELECT id, company, title, url, ats, status FROM jobs WHERE ats = 'LEVER' OR url LIKE '%lever.co%'"
  );
  console.log("Found", jobs.rowCount, "Lever jobs:");
  for (const j of jobs.rows) {
    console.log(`- [${j.id}] ${j.company} | ${j.title} | ${j.status} | ${j.url}`);
  }

  const apps = await db.query(
    `SELECT a.id, a.user_id, a.job_id, a.status, a.confirmation, a.error_message, j.company, j.title 
     FROM applications a 
     JOIN jobs j ON a.job_id = j.id 
     WHERE a.ats = 'LEVER' OR j.ats = 'LEVER'`
  );
  console.log("\nFound", apps.rowCount, "Lever applications:");
  for (const a of apps.rows) {
    console.log(`- App [${a.id}] User [${a.user_id}] | ${a.company} - ${a.title} | Status: ${a.status} | Conf: ${a.confirmation} | Err: ${a.error_message}`);
  }

  await db.close();
}

main().catch(console.error);
