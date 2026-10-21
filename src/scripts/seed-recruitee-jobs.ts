import { db } from "../database/db";
import { withBrowserPage } from "../browser/browser-manager";
import { detectATSByUrl } from "../ats/ats-detector";
import { detectAndGetAdapter } from "../ats/ats-factory";
import { v4 as uuidv4 } from "uuid";

export const DEFAULT_RECRUITEE_JOBS = [
  "https://jobs.emergentsoftware.net/o/account-manager-ecommerce",
  "https://jobs.emergentsoftware.net/o/solutions-engineer-optical-metrology",
  "https://jobs.emergentsoftware.net/o/accounts-receivable-specialist",
  "https://jobs.emergentsoftware.net/o/technical-product-owner-data",
  "https://jobs.emergentsoftware.net/o/embedded-software-engineer",
  "https://jobs.emergentsoftware.net/o/ai-architect",
  "https://careers.techwolf.ai/o/ai-engineering-lead/c/new",
  "https://careers.techwolf.ai/o/internship-software-engineer/c/new"
];

function deriveFallbackDetails(url: string): { company: string; title: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let company = "Recruitee Company";
    if (host.includes("emergentsoftware.net")) company = "Emergent Software";
    else if (host.includes("techwolf.ai")) company = "TechWolf";
    else {
      const cleanHost = host.replace(/^(jobs|careers)\./, "").split(".")[0];
      company = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
    }

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const slugIdx = pathParts.indexOf("o");
    let title = "Position";
    if (slugIdx !== -1 && pathParts[slugIdx + 1]) {
      title = pathParts[slugIdx + 1]
        .split("-")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return { company, title };
  } catch {
    return { company: "Recruitee Company", title: "Position" };
  }
}

export async function seedRecruiteeJobs(inputUrls?: string[]) {
  console.log("===============================================================================");
  console.log("💼 SEEDING RECRUITEE JOBS INTO DATABASE FOR CANDIDATE HRUTIN NAMMI");
  console.log("===============================================================================\n");

  const jobsToSeed = inputUrls && inputUrls.length > 0 ? inputUrls : DEFAULT_RECRUITEE_JOBS;

  // 1. Get user Hrutin
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
  if (resumeRes.rowCount === 0) {
    console.error("❌ No active PDF resume found for Hrutin. Run database seed first!");
    process.exit(1);
  }
  const resumeId = resumeRes.rows[0].id;
  const resumeFileName = resumeRes.rows[0].file_name;
  console.log(`📄 Assigned Active Resume: ${resumeFileName} (${resumeId})\n`);

  for (let i = 0; i < jobsToSeed.length; i++) {
    const url = jobsToSeed[i];
    console.log(`-------------------------------------------------------------------------------`);
    console.log(`[Job ${i + 1}/${jobsToSeed.length}] Processing: ${url}`);

    const ats = detectATSByUrl(url) || "RECRUITEE";
    console.log(`🔍 Detected ATS: ${ats}`);

    const fallback = deriveFallbackDetails(url);
    let company = fallback.company;
    let title = fallback.title;
    let description = "";

    try {
      await withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(1000);

        const { adapter } = await detectAndGetAdapter(page, url);
        const jobDetails = await adapter.extractJob(page);
        company = jobDetails.company || company;
        title = jobDetails.title || title;
        description = jobDetails.description || description;
      }, { headless: true });
    } catch (err: any) {
      console.warn(`⚠️ Warning extracting job details: ${err.message}. Using derived info: ${company} - ${title}`);
    }

    console.log(`🏢 Company: ${company}`);
    console.log(`💼 Title: ${title}`);

    // Insert or update Job record
    let jobId: string;
    const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);
    if (existingJob.rowCount > 0) {
      jobId = existingJob.rows[0].id;
      console.log(`🔄 Updating existing Job record (${jobId})...`);
      await db.query(
        `UPDATE jobs 
         SET company = $1, title = $2, description = $3, ats = $4, status = 'EXTRACTED'
         WHERE id = $5`,
        [company, title, description, ats, jobId]
      );
    } else {
      jobId = uuidv4();
      console.log(`➕ Inserting new Job record (${jobId})...`);
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [jobId, url, company, title, description, ats, "EXTRACTED"]
      );
    }

    // Insert or update Application record
    const existingApp = await db.query(
      "SELECT id FROM applications WHERE user_id = $1 AND job_id = $2",
      [userId, jobId]
    );
    let applicationId: string;
    if (existingApp.rowCount > 0) {
      applicationId = existingApp.rows[0].id;
      console.log(`🔄 Updating Application record (${applicationId}) -> PENDING...`);
      await db.query(
        `UPDATE applications 
         SET resume_id = $1, ats = $2, status = 'PENDING', updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [resumeId, ats, applicationId]
      );
    } else {
      applicationId = uuidv4();
      console.log(`➕ Inserting new Application record (${applicationId})...`);
      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [applicationId, userId, jobId, resumeId, ats, "PENDING"]
      );
    }
  }

  console.log(`\n===============================================================================`);
  console.log(`🎉 ALL ${jobsToSeed.length} RECRUITEE JOBS SUCCESSFULLY SEEDED IN DATABASE!`);
  console.log(`===============================================================================\n`);
}

if (require.main === module) {
  const cliUrls = process.argv.slice(2).filter(arg => arg.startsWith("http://") || arg.startsWith("https://"));
  seedRecruiteeJobs(cliUrls.length > 0 ? cliUrls : undefined)
    .then(() => db.close())
    .catch((err) => {
      console.error("❌ Fatal Error seeding Recruitee jobs:", err);
      db.close();
      process.exit(1);
    });
}
