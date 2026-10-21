import { db } from "../src/database/db";

async function addSmartRecruitersJobs() {
  const jobs = [
    {
      id: "sr_linkedin_software_engineer",
      url: "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3",
      company: "LinkedIn",
      title: "Software Engineer",
      description: "Software Engineer application at LinkedIn via SmartRecruiters",
      ats: "SMARTRECRUITERS",
      status: "PENDING"
    },
    {
      id: "sr_servicenow_staff_engineer",
      url: "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow",
      company: "ServiceNow",
      title: "Staff Software Engineer",
      description: "Staff Software Engineer application at ServiceNow via SmartRecruiters",
      ats: "SMARTRECRUITERS",
      status: "PENDING"
    }
  ];

  for (const job of jobs) {
    const existing = await db.query("SELECT id FROM jobs WHERE url = $1", [job.url]);
    if (existing.rowCount === 0) {
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [job.id, job.url, job.company, job.title, job.description, job.ats, job.status]
      );
      console.log(`✅ Added SmartRecruiters job: [${job.company}] ${job.title}`);
    } else {
      await db.query(
        `UPDATE jobs SET ats = $1, status = $2, company = $3, title = $4 WHERE url = $5`,
        [job.ats, job.status, job.company, job.title, job.url]
      );
      console.log(`ℹ️ Updated SmartRecruiters job: [${job.company}] ${job.title}`);
    }
  }

  await db.close();
}

addSmartRecruitersJobs().catch(async (e) => {
  console.error("❌ Error adding SmartRecruiters jobs:", e);
  await db.close();
});
