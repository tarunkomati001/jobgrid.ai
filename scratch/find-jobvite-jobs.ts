import { db } from "../src/database/db";

async function run() {
  const jobs = await db.query("SELECT * FROM jobs WHERE ats = 'JOBVITE' OR url LIKE '%jobvite%'");
  console.log("Jobvite jobs:", jobs.rows.map(j => ({ id: j.id, title: j.title, url: j.url })));
  process.exit(0);
}

run();
