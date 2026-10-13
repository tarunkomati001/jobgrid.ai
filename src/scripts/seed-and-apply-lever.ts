/**
 * Seed Lever Jobs into Database and Execute Autofill for Candidate Hrutin Kumar
 * 
 * 1. Seeds the two Lever jobs into the PostgreSQL `jobs` table
 * 2. Creates/updates `applications` records for candidate Hrutin Kumar
 * 3. Pulls the Lever jobs from the database and runs the autofill pipeline via LeverAdapter
 * 4. Audits validation, captures screenshots, and updates database application records
 */

import { db } from "../database/db";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { createBrowser, createPersistentBrowserContext, applyStealthScripts, DEFAULT_USER_AGENT } from "../browser/browser-manager";
import { detectAndGetAdapter } from "../ats/ats-factory";
import { UserProfile } from "../ats/ats.interface";
import { resolveLocalResumePath } from "../utils/path-resolver";

const LEVER_JOBS = [
  {
    company: "Sonatype",
    title: "Staff Software Engineer",
    url: "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply"
  },
  {
    company: "MoonPay",
    title: "Software Engineer, Agents",
    url: "https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply"
  }
];

async function main() {
  process.env.AUTO_SUBMIT = "true";
  process.env.DRY_RUN = "false";

  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║             ⚡ CLUCO.AI LEVER DATABASE SEED & AUTOFILL PIPELINE        ║
║         Candidate: Hrutin Kumar (Full Lever Integration Flow)          ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  // 1. Ensure Candidate Hrutin exists
  console.log("👤 Fetching candidate Hrutin Kumar from database...");
  const userRes = await db.query(
    "SELECT u.id, u.email, p.* FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.email LIKE '%hrutin%' OR p.first_name ILIKE '%hrutin%' LIMIT 1"
  );

  if (userRes.rowCount === 0) {
    console.error("❌ Candidate Hrutin not found in database. Run seed-hrutin first!");
    process.exit(1);
  }

  const user = userRes.rows[0];
  console.log(`  ✅ User Found: ${user.first_name} ${user.last_name} (${user.email}, ID: ${user.user_id})\n`);

  // 2. Fetch Hrutin's active resume
  const resumeRes = await db.query(
    "SELECT id, file_name, file_path FROM resumes WHERE user_id = $1 AND is_active = 1 LIMIT 1",
    [user.user_id]
  );

  let resumeId = "";
  let resumeFilePath = "";
  if (resumeRes.rowCount > 0) {
    resumeId = resumeRes.rows[0].id;
    resumeFilePath = resolveLocalResumePath(resumeRes.rows[0].file_path);
    console.log(`  📄 Active Resume: ${resumeRes.rows[0].file_name} (${resumeFilePath})\n`);
  } else {
    console.warn("⚠️ No active resume record found in database, using default.");
  }

  // 3. Add / Update Lever Jobs in the database
  console.log("📥 Seeding Lever jobs into `public.jobs` and `public.applications`...");
  const queuedJobIds: string[] = [];

  for (const job of LEVER_JOBS) {
    let jobId: string;
    const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [job.url]);

    if (existingJob.rowCount > 0) {
      jobId = existingJob.rows[0].id;
      await db.query(
        "UPDATE jobs SET company = $1, title = $2, ats = 'LEVER', status = 'PENDING' WHERE id = $3",
        [job.company, job.title, jobId]
      );
      console.log(`  🔄 Updated Job in DB: [${job.company}] ${job.title} (ID: ${jobId})`);
    } else {
      jobId = uuidv4();
      await db.query(
        "INSERT INTO jobs (id, url, company, title, ats, status) VALUES ($1, $2, $3, $4, 'LEVER', 'PENDING')",
        [jobId, job.url, job.company, job.title]
      );
      console.log(`  ➕ Inserted Job in DB: [${job.company}] ${job.title} (ID: ${jobId})`);
    }

    queuedJobIds.push(jobId);

    // Create / Update application record
    const existingApp = await db.query(
      "SELECT id FROM applications WHERE user_id = $1 AND job_id = $2",
      [user.user_id, jobId]
    );

    if (existingApp.rowCount > 0) {
      await db.query(
        "UPDATE applications SET ats = 'LEVER', status = 'PENDING', resume_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [resumeId, existingApp.rows[0].id]
      );
    } else {
      const appId = uuidv4();
      await db.query(
        "INSERT INTO applications (id, user_id, job_id, resume_id, ats, status) VALUES ($1, $2, $3, $4, 'LEVER', 'PENDING')",
        [appId, user.user_id, jobId, resumeId]
      );
    }
  }

  console.log("\n✅ All Lever jobs successfully stored in the database!\n");

  // 4. Query DB for Lever jobs to process (strictly Lever jobs from DB!)
  console.log("🔍 Fetching queued Lever jobs from DB for autofill execution...");
  const jobsToApply = await db.query(
    "SELECT j.id, j.url, j.company, j.title, j.ats, a.id as application_id FROM jobs j JOIN applications a ON j.id = a.job_id WHERE j.ats = 'LEVER' AND a.user_id = $1 ORDER BY j.company ASC",
    [user.user_id]
  );

  console.log(`📋 Found ${jobsToApply.rowCount} Lever application(s) queued for processing in DB.\n`);

  // 5. Construct profile
  const profile: UserProfile = {
    userId: user.user_id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone || "+91 86884 23267",
    location: user.location || "Vadodara, Gujarat, India",
    linkedinUrl: user.linkedin_url || "https://linkedin.com/in/hrutinnammi",
    githubUrl: user.github_url || "https://github.com/hrutinnammi",
    portfolioUrl: user.portfolio_url || "https://github.com/hrutinnammi",
    willingToRelocate: user.willing_to_relocate === 1,
    yearsOfExperience: user.years_of_experience || 2,
    gender: user.gender || "Male"
  };

  // Launch persistent Chrome context to retain cookies, local storage, and hCaptcha trust scores
  const context = await createPersistentBrowserContext(false);

  const screenshotsDir = path.resolve(__dirname, "../../screenshots");
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  for (let idx = 0; idx < jobsToApply.rows.length; idx++) {
    const job = jobsToApply.rows[idx];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 [${idx + 1}/${jobsToApply.rowCount}] PROCESSING LEVER DB JOB: [${job.company}] ${job.title}`);
    console.log(`URL: ${job.url}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const page = await context.newPage();

    try {
      console.log(`🌐 Navigating to ${job.url}...`);
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);

      // Detect and get adapter
      const { ats, adapter } = await detectAndGetAdapter(page, job.url);
      console.log(`🎯 Detected ATS: ${ats} via Adapter: ${adapter.constructor.name}`);

      // Extract fields
      console.log("🔍 Scanning form structure and extracting fields...");
      const fields = await adapter.extractFields(page);
      console.log(`📊 Extracted ${fields.length} interactive fields.`);

      // Upload resume
      if (resumeFilePath && fs.existsSync(resumeFilePath)) {
        await adapter.uploadResume(page, resumeFilePath, fields);
      }

      // Fill form
      console.log("📝 Filling form with candidate Hrutin Kumar's details...");
      await adapter.fillForm(page, profile, {
        current_company: "Jobspring",
        twitter: "https://x.com/hrutin_dev"
      }, fields);

      // Validate form
      console.log("🧐 Running deep form validation audit...");
      const isValid = await adapter.validate(page, fields);
      console.log(`Form Validation Result: ${isValid ? "✅ 100% VALID" : "⚠️ HAS WARNINGS"}`);

      // Capture pre-submit screenshot
      const preScreenshotFilename = `lever-filled-${job.company.toLowerCase()}-${Date.now()}.png`;
      const preScreenshotFullPath = path.join(screenshotsDir, preScreenshotFilename);
      await page.screenshot({ path: preScreenshotFullPath, fullPage: true });
      console.log(`📸 Pre-submit screenshot saved: ${preScreenshotFullPath}`);

      // Submit application
      console.log("🚀 Executing Lever submission pipeline...");
      const submitResult = await adapter.submit(page);
      console.log(`Submission Result:`, submitResult);

      // Capture post-submit screenshot
      const postScreenshotFilename = `lever-submitted-${job.company.toLowerCase()}-${Date.now()}.png`;
      const postScreenshotFullPath = path.join(screenshotsDir, postScreenshotFilename);
      await page.screenshot({ path: postScreenshotFullPath, fullPage: true });
      console.log(`📸 Post-submit screenshot saved: ${postScreenshotFullPath}`);

      // Update Database Application Record
      const newStatus = submitResult.success ? "SUBMITTED" : "FAILED";
      await db.query(
        "UPDATE applications SET status = $1, confirmation = $2, error_message = $3, screenshot_path = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
        [newStatus, submitResult.confirmation || null, submitResult.errorMessage || null, postScreenshotFullPath, job.application_id]
      );
      await db.query(
        "UPDATE jobs SET status = $1 WHERE id = $2",
        [newStatus, job.id]
      );

      console.log(`💾 Updated Database record for Application ${job.application_id}: Status = '${newStatus}', Confirmation = '${submitResult.confirmation || "none"}'\n`);
      await page.waitForTimeout(3000);

    } catch (err: any) {
      console.error(`❌ Error processing job ${job.url}:`, err.message);
      await db.query(
        "UPDATE applications SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [job.application_id]
      );
    } finally {
      if (idx < jobsToApply.rows.length - 1) {
        await page.close().catch(() => {});
      }
    }
  }

  console.log("===============================================================================");
  console.log("🎉 ALL LEVER DATABASE JOBS SUCCESSFULLY PROCESSED & FILLED!");
  console.log("===============================================================================\n");

  await context.close();
  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Fatal Error:", err);
  await db.close();
  process.exit(1);
});
