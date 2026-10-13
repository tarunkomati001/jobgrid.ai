import { db } from "../src/database/db";

async function main() {
  const jobs = await db.query("SELECT id, url, title, company, ats, status FROM jobs WHERE ats = 'TALEO' OR url LIKE '%taleo%'");
  console.log("Taleo jobs count:", jobs.rowCount);
  console.log(jobs.rows);

  const apps = await db.query("SELECT a.id, a.user_id, a.job_id, a.status, j.url FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.ats = 'TALEO' OR j.url LIKE '%taleo%'");
  console.log("Taleo applications count:", apps.rowCount);
  console.log(apps.rows);

  await db.close();
}

main().catch(console.error);
