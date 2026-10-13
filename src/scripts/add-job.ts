import { db } from "../database/db";
import { withBrowserPage } from "../browser/browser-manager";
import { detectATSByUrl } from "../ats/ats-detector";
import { detectAndGetAdapter } from "../ats/ats-factory";
import { v4 as uuidv4 } from "uuid";

async function main() {
  const url = process.argv[2] || "https://jobs.ashbyhq.com/vanta/fe5fd1a4-12ff-4703-bed5-6c2f34ba7768/application";
  console.log(`📥 Initiating add-job for URL: ${url}`);

  // 1. Get first user in DB
  const userRes = await db.query("SELECT id, email FROM users LIMIT 1");
  if (userRes.rowCount === 0) {
    console.error("❌ No users found in database. Run database seed first!");
    process.exit(1);
  }
  const userId = userRes.rows[0].id;
  const userEmail = userRes.rows[0].email;
  console.log(`👤 Using User: ${userEmail} (${userId})`);

  // 2. Get active resume
  const resumeRes = await db.query("SELECT id, file_name FROM resumes WHERE user_id = $1 AND is_active = 1", [userId]);
  if (resumeRes.rowCount === 0) {
    console.error("❌ No active resume found. Seed database first!");
    process.exit(1);
  }
  const resumeId = resumeRes.rows[0].id;
  const resumeFileName = resumeRes.rows[0].file_name;
  console.log(`📄 Using Active Resume: ${resumeFileName} (${resumeId})`);

  // 3. Detect ATS
  const ats = detectATSByUrl(url);
  console.log(`🔍 Detected ATS by URL: ${ats}`);

  // 4. Launch browser to extract job details
  console.log("🌐 Launching browser to extract job details...");
  let company = "Unknown Company";
  let title = "Unknown Position";
  let description = "";

  try {
    await withBrowserPage(async (page) => {
      console.log(`[Browser] Going to ${url}...`);
      await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(err => {
        console.warn(`[Browser] Warning during page navigation: ${err.message}. Proceeding with extraction anyway.`);
      });
      
      const { adapter } = await detectAndGetAdapter(page, url);
      const jobDetails = await adapter.extractJob(page);
      company = jobDetails.company || company;
      title = jobDetails.title || title;
      description = jobDetails.description || description;
    }, { headless: true });
  } catch (browserError: any) {
    console.error("⚠️ Failed to load job page for details extraction:", browserError.message);
    console.log("Proceeding with placeholder details...");
  }

  console.log(`🏢 Extracted Company: ${company}`);
  console.log(`💼 Extracted Title: ${title}`);

  // 5. Save or update job record
  let jobId: string;
  const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);
  if (existingJob.rowCount > 0) {
    jobId = existingJob.rows[0].id;
    console.log(`🔄 Job record already exists. ID: ${jobId}. Updating...`);
    await db.query(
      `UPDATE jobs 
       SET company = $1, title = $2, description = $3, ats = $4, status = 'EXTRACTED'
       WHERE id = $5`,
      [company, title, description, ats, jobId]
    );
  } else {
    jobId = uuidv4();
    console.log(`➕ Inserting new Job record. ID: ${jobId}`);
    await db.query(
      `INSERT INTO jobs (id, url, company, title, description, ats, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [jobId, url, company, title, description, ats, "EXTRACTED"]
    );
  }

  // 6. Create application record
  const existingApp = await db.query("SELECT id FROM applications WHERE user_id = $1 AND job_id = $2", [userId, jobId]);
  let applicationId: string;
  if (existingApp.rowCount > 0) {
    applicationId = existingApp.rows[0].id;
    console.log(`🔄 Application record already exists. ID: ${applicationId}. Resetting to PENDING...`);
    await db.query(
      `UPDATE applications 
       SET resume_id = $1, ats = $2, status = 'PENDING', updated_at = datetime('now')
       WHERE id = $3`,
      [resumeId, ats, applicationId]
    );
  } else {
    applicationId = uuidv4();
    console.log(`➕ Inserting new Application record. ID: ${applicationId}`);
    await db.query(
      `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [applicationId, userId, jobId, resumeId, ats, "PENDING"]
    );
  }

  console.log("✅ Job and Application successfully added/updated in the database!");
  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Fatal Error:", err);
  await db.close();
  process.exit(1);
});
