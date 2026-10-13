import { db } from "../src/database/db";

async function main() {
  const newLoc = "1/908 aaradhya, limda , wagodhiya, Vadodara, Gujarat, 390144, India";
  console.log("Updating Hrutin's profile location to:", newLoc);
  await db.query(
    "UPDATE user_profiles SET location = $1 WHERE user_id = 'usr_hrutin_nammi'",
    [newLoc]
  );
  console.log("Updated successfully!");

  // Also upsert the 4 Oracle jobs into the jobs table if not present
  const jobs = [
    { id: "job_oracle_344557", title: "Software Development Manager", url: "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer", ats: "ORACLE" },
    { id: "job_oracle_344708", title: "Principal Software Engineer, Platform", url: "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location", ats: "ORACLE" },
    { id: "job_oracle_345236", title: "Principal Software Engineer, Platform", url: "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/345236/?keyword=software+engineer", ats: "ORACLE" },
    { id: "job_oracle_338844", title: "Senior Software Development Engineer", url: "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/338844/?keyword=software+engineers", ats: "ORACLE" }
  ];

  for (const j of jobs) {
    await db.query(
      `INSERT INTO jobs (id, company, title, url, ats, status, created_at)
       VALUES ($1, 'Oracle', $2, $3, $4, 'EXTRACTED', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET url = $3, ats = $4`,
      [j.id, j.title, j.url, j.ats]
    ).catch(() => {});
  }
  console.log("Jobs upserted into database.");
  await db.close();
}

main().catch(console.error);
