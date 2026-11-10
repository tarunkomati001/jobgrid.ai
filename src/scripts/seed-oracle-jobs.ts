import { v4 as uuidv4 } from "uuid";
import { db } from "../database/db";
import { detectATSByUrl } from "../ats/ats-detector";

export const DEFAULT_ORACLE_JOBS = [
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/347693/?location=United+States&locationId=300000000149325",
  "https://eihu.fa.us8.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/jobs/preview/2617438/"
];

function deriveOracleDetails(url: string): { company: string; title: string } {
  if (url.includes("careers.oracle.com")) {
    return {
      company: "Oracle",
      title: "Lead Principal Application Software Engineer"
    };
  }
  if (url.includes("oraclecloud.com")) {
    return {
      company: "SAIC",
      title: "Engineering Technician"
    };
  }
  return {
    company: "Oracle Recruiting",
    title: "Software Engineer"
  };
}

export async function seedOracleJobs(inputUrls?: string[]) {
  console.log("===============================================================================");
  console.log("💼 SEEDING ORACLE JOBS INTO DATABASE FOR CANDIDATE HRUTIN NAMMI");
  console.log("===============================================================================");

  const jobsToSeed = inputUrls && inputUrls.length > 0 ? inputUrls : DEFAULT_ORACLE_JOBS;

  // 1. Get primary user Hrutin
  const userRes = await db.query(
    "SELECT id, email FROM users WHERE id = 'usr_hrutin_nammi' OR email = 'babufakemail@gmail.com' LIMIT 1"
  );
  if (userRes.rowCount === 0) {
    console.error("❌ Candidate Hrutin Nammi not found in database. Run database seed first!");
    process.exit(1);
  }
  const userId = userRes.rows[0].id;
  const userEmail = userRes.rows[0].email;
  console.log(`👤 Assigned Candidate: ${userEmail} (${userId})`);

  // 2. Get active resume for Hrutin
  const resumeRes = await db.query(
    "SELECT id, file_name FROM resumes WHERE user_id = $1 AND is_active = 1 AND (resume_type = 'PDF' OR resume_type IS NULL) LIMIT 1",
    [userId]
  );
  const resumeId = resumeRes.rows[0]?.id || "res_usr_hrutin_nammi";
  console.log(`📄 Assigned Active Resume: ${resumeId}\n`);

  for (let i = 0; i < jobsToSeed.length; i++) {
    const url = jobsToSeed[i];
    console.log(`-------------------------------------------------------------------------------`);
    console.log(`[Job ${i + 1}/${jobsToSeed.length}] Processing: ${url}`);

    const ats = detectATSByUrl(url) || "ORACLE";
    console.log(`🔍 Detected ATS: ${ats}`);

    const details = deriveOracleDetails(url);
    const company = details.company;
    const title = details.title;
    const description = `${company} job requisition (${title}) powered by Oracle Cloud Recruiting.`;

    console.log(`🏢 Company: ${company}`);
    console.log(`💼 Title: ${title}`);

    // Insert or update Job record
    let jobId: string;
    const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);

    if (existingJob.rowCount > 0) {
      jobId = existingJob.rows[0].id;
      await db.query(
        `UPDATE jobs 
         SET title = $1, company = $2, description = $3, ats = $4, status = 'EXTRACTED'
         WHERE id = $5`,
        [title, company, description, ats, jobId]
      );
      console.log(`🔄 Updated existing Job record: ${jobId}`);
    } else {
      jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [jobId, url, company, title, description, ats, "EXTRACTED"]
      );
      console.log(`✨ Created new Job record: ${jobId}`);
    }

    // Insert or update Application record
    const existingApp = await db.query(
      "SELECT id FROM applications WHERE user_id = $1 AND job_id = $2",
      [userId, jobId]
    );

    if (existingApp.rowCount > 0) {
      await db.query(
        `UPDATE applications 
         SET ats = $1, status = 'PENDING', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [ats, existingApp.rows[0].id]
      );
      console.log(`🔄 Updated existing Application: ${existingApp.rows[0].id} (Status: PENDING)`);
    } else {
      const appId = uuidv4();
      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [appId, userId, jobId, resumeId, ats, "PENDING"]
      );
      console.log(`✨ Created new Application: ${appId} (Status: PENDING)`);
    }
  }

  console.log(`\n===============================================================================`);
  console.log(`🎉 ALL ${jobsToSeed.length} ORACLE JOBS SUCCESSFULLY SEEDED IN DATABASE!`);
  console.log(`===============================================================================\n`);
}

if (process.argv[1]?.includes("seed-oracle-jobs")) {
  const cliUrls = process.argv.slice(2).filter((arg) => arg.startsWith("http"));
  seedOracleJobs(cliUrls.length > 0 ? cliUrls : undefined)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Fatal Error seeding Oracle jobs:", err);
      process.exit(1);
    });
}
