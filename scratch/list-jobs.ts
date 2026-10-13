import { db } from "../src/database/db";

async function listJobs() {
  console.log("===============================================================================");
  console.log("💼 AVAILABLE JOB LINKS IN DATABASE");
  console.log("===============================================================================\n");

  try {
    const res = await db.query(
      "SELECT id, company, title, url, ats, status, created_at FROM public.jobs ORDER BY created_at DESC"
    );

    console.log(`Found ${res.rowCount} job link(s) in the database:\n`);

    res.rows.forEach((job: any, index: number) => {
      console.log(`${index + 1}. [${job.company || "Unknown"}] ${job.title || "Position"}`);
      console.log(`   URL: ${job.url}`);
      console.log(`   ATS: ${job.ats} | Status: ${job.status} | ID: ${job.id}`);
      console.log("--------------------------------------------------------------------------------");
    });

  } catch (error: any) {
    console.error("❌ Error querying jobs:", error.message);
  } finally {
    await db.close();
    process.exit(0);
  }
}

listJobs();
