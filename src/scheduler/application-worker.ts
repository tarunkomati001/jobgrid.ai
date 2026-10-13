import path from "path";
import fs from "fs";
import { config } from "../config";
import { db } from "../database/db";
import { logApplicationEvent } from "../database/event-logger";
import { withBrowserPage } from "../browser/browser-manager";
import { detectAndGetAdapter } from "../ats/ats-factory";
import { UserProfile } from "../ats/ats.interface";
import { resolveLocalResumePath } from "../utils/path-resolver";

/**
 * Resolves a resume path from the database. If it's a URL or Supabase storage path,
 * it downloads it locally into a temporary file.
 * Returns the local file path to use for uploading, and a boolean indicating if it is a temp file.
 */
async function resolveAndDownloadResume(
  filePathOrUrl: string,
  resumeId: string
): Promise<{ localPath: string; isTemp: boolean }> {
  const localResolved = resolveLocalResumePath(filePathOrUrl);
  if (fs.existsSync(localResolved)) {
    console.log(`📂 Using local resume file: ${localResolved}`);
    return { localPath: localResolved, isTemp: false };
  }

  // 2. Resolve target URL
  let downloadUrl = filePathOrUrl;
  const isUrl = filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://");

  if (!isUrl) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error(
        "Cannot download relative Supabase Storage path because SUPABASE_URL and SUPABASE_ANON_KEY are not configured"
      );
    }
    // Assume relative path: construct authenticated object URL
    const cleanPath = filePathOrUrl.startsWith("/") ? filePathOrUrl.substring(1) : filePathOrUrl;
    downloadUrl = `${config.supabaseUrl}/storage/v1/object/authenticated/${cleanPath}`;
  }

  console.log(`📥 Downloading resume from: ${downloadUrl}`);

  // 3. Setup temporary local download path
  const filename = path.basename(filePathOrUrl) || "resume.pdf";
  const tempPath = path.join(config.resumesDir, `temp_${resumeId}_${filename}`);
  
  // Make sure resumes directory exists
  await fs.promises.mkdir(config.resumesDir, { recursive: true });

  // 4. Download file using native fetch
  const headers: Record<string, string> = {};
  if (config.supabaseAnonKey && (!isUrl || downloadUrl.startsWith(config.supabaseUrl || ""))) {
    headers["Authorization"] = `Bearer ${config.supabaseAnonKey}`;
    headers["apikey"] = config.supabaseAnonKey;
  }

  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download resume from Supabase Storage: ${response.statusText} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(tempPath, buffer);

  console.log(`✅ Resume downloaded successfully to temporary path: ${tempPath}`);
  return { localPath: tempPath, isTemp: true };
}

/**
 * Checks if the user has exceeded their daily application quota limit.
 */
async function checkDailyLimitExceeded(): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count 
    FROM applications 
    WHERE status = 'SUBMITTED' 
      AND date(submitted_at) = date('now')
  `;
  const result = await db.query(query);
  const count = result.rows[0]?.count || 0;
  
  const dailyLimit = (process.env.DAILY_LIMIT && parseInt(process.env.DAILY_LIMIT)) || 20;
  console.log(`📊 Quota check: ${count} / ${dailyLimit} applications submitted today.`);
  
  return count >= dailyLimit;
}

/**
 * Processes a single job application.
 */
export async function processApplication(
  applicationId: string,
  userId: string,
  jobId: string,
  url: string,
  additionalAnswers: Record<string, string> = {}
): Promise<void> {
  console.log(`🤖 [Worker]: Initiating process for application: ${applicationId}`);
  
  let resumePath: string | null = null;
  let isResumeTemp = false;
  
  // 1. Update application status to PROCESSING
  await db.query(
    "UPDATE applications SET status = 'PROCESSING', updated_at = datetime('now') WHERE id = $1",
    [applicationId]
  );
  await logApplicationEvent(applicationId, "JOB_OPENED", { url, jobId });

  // 2. Check Daily Quota Limit
  const limitExceeded = await checkDailyLimitExceeded();
  if (limitExceeded) {
    console.error("❌ [Worker]: Daily quota limit reached. Job failed.");
    await db.query(
      "UPDATE applications SET status = 'FAILED', error_message = 'DAILY_LIMIT_EXCEEDED', updated_at = datetime('now') WHERE id = $1",
      [applicationId]
    );
    await logApplicationEvent(applicationId, "FAILED", { reason: "DAILY_LIMIT_EXCEEDED" });
    return;
  }

  try {
    // 3. Fetch candidate profile and active resume
    const profileRes = await db.query(
      "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = $1",
      [userId]
    );
    const resumeRes = await db.query(
      "SELECT * FROM resumes WHERE user_id = $1 AND is_active = 1",
      [userId]
    );

    if (profileRes.rowCount === 0) {
      throw new Error("USER_PROFILE_NOT_FOUND");
    }
    if (resumeRes.rowCount === 0) {
      throw new Error("ACTIVE_RESUME_NOT_FOUND");
    }

    const dbProfile = profileRes.rows[0];
    const profile: UserProfile = {
      userId: dbProfile.user_id,
      firstName: dbProfile.first_name,
      lastName: dbProfile.last_name,
      email: dbProfile.email,
      phone: dbProfile.phone,
      location: dbProfile.location,
      linkedinUrl: dbProfile.linkedin_url,
      githubUrl: dbProfile.github_url,
      portfolioUrl: dbProfile.portfolio_url,
      workAuthorization: dbProfile.work_authorization,
      willingToRelocate: dbProfile.willing_to_relocate === 1,
      yearsOfExperience: dbProfile.years_of_experience,
    };
    const dbResume = resumeRes.rows[0];
    const resolvedResume = await resolveAndDownloadResume(dbResume.file_path, dbResume.id);
    resumePath = resolvedResume.localPath;
    isResumeTemp = resolvedResume.isTemp;

    // 4. Launch Browser & execute application sequence
    const submitResult = await withBrowserPage(async (page) => {
      console.log(`[Worker] Loading page: ${url}`);
      // Bug 1 fix: use 'load' instead of 'networkidle'.
      // networkidle can stall 5-10s on pages with persistent analytics beacons.
      // We wait for the first form element instead, which is fast and reliable.
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForSelector(
        "input:not([type='hidden']), textarea, select, [data-field-path], button:has-text('Apply')",
        { timeout: 10000 }
      ).catch(() => console.warn("[Worker] Timed out waiting for form elements after page load."));

      // Detect ATS & Instantiate Adapter via ATS Factory
      const { ats, adapter } = await detectAndGetAdapter(page, url);
      await logApplicationEvent(applicationId, "ATS_DETECTED", { ats });
      
      if (ats !== "ASHBY" && ats !== "GREENHOUSE" && ats !== "LEVER") {
        throw new Error(`ATS_NOT_SUPPORTED: ${ats}`);
      }

      // Extract job details and update the jobs table dynamically
      try {
        const jobDetails = await adapter.extractJob(page);
        await db.query(
          `UPDATE jobs 
           SET company = $1, title = $2, description = $3, status = 'EXTRACTED' 
           WHERE id = $4`,
          [jobDetails.company || "Unknown Company", jobDetails.title || "Unknown Position", jobDetails.description || "", jobId]
        );
        console.log(`📝 [Worker]: Job details updated for Job [${jobId}] -> "${jobDetails.title}" at "${jobDetails.company}"`);
      } catch (err: any) {
        console.error(`⚠️ [Worker]: Failed to update job details for Job [${jobId}]:`, err.message);
      }

      // Bug 2 fix: extract fields ONCE and pass them to all adapter methods.
      // Previously, fillForm/uploadResume/validate each re-scanned the DOM independently,
      // each triggering a scrollPage() with a 500ms wait — a significant, redundant cost.
      const fields = await adapter.extractFields(page);
      await logApplicationEvent(applicationId, "FORM_EXTRACTED", { fieldCount: fields.length });

      // Upload resume first so the resume parser runs before we fill fields.
      if (!resumePath) {
        throw new Error("ACTIVE_RESUME_NOT_FOUND");
      }
      await adapter.uploadResume(page, resumePath, fields);
      await logApplicationEvent(applicationId, "RESUME_UPLOADED", { resumePath });

      // Bug 6 fix: wait for Ashby's async resume parser to complete before filling.
      // Without this wait, the parser can overwrite email/phone/LinkedIn fields after we fill them.
      console.log("[Worker] Waiting for resume parser to complete...");
      await page.waitForSelector(
        "[data-upload-state='complete'], [class*='uploadComplete'], [class*='upload-complete']",
        { timeout: 12000 }
      ).catch(() => {
        console.warn("[Worker] Resume parser completion indicator not found — proceeding with fillForm.");
      });

      // Autofill form using the already-extracted fields (no second DOM scan)
      await adapter.fillForm(page, profile, additionalAnswers, fields);
      await logApplicationEvent(applicationId, "FORM_FILLED");

      // Validate inputs — pass pre-extracted fields to avoid yet another DOM scan
      const isValid = await adapter.validate(page, fields);

      // Capture screenshot immediately after filling
      const filename = `worker_filled_${Date.now()}.png`;
      const screenshotPath = path.join(config.screenshotsDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await logApplicationEvent(applicationId, "SCREENSHOT_CAPTURED", { screenshotPath });

      if (!isValid) {
        console.warn(`⚠️ [Worker]: Validation check reported some fields may be incomplete. Attempting submission anyway — ${ats} will catch real errors.`);
      } else {
        await logApplicationEvent(applicationId, "VALIDATION_PASSED");
      }

      // Auto-submit policy: Auto-submit ONLY for LEVER jobs!
      if (ats === "LEVER") {
        process.env.AUTO_SUBMIT = "true";
        process.env.DRY_RUN = "false";
        console.log(`[Worker] Auto-submit enabled for ${ats} job.`);
      } else {
        process.env.AUTO_SUBMIT = "false";
        process.env.DRY_RUN = "true";
        console.log(`[Worker] Auto-submit disabled for ${ats} job (manual review mode).`);
      }

      // Execute submission (Lever auto-submits, others stay in manual mode)
      const submission = await adapter.submit(page);

      let finalScreenshotPath = screenshotPath;
      if (!submission.success) {
        // Capture screenshot of submission failure (e.g. error banner)
        const errFilename = `worker_error_${Date.now()}.png`;
        const errScreenshotPath = path.join(config.screenshotsDir, errFilename);
        await page.screenshot({ path: errScreenshotPath, fullPage: true });
        finalScreenshotPath = errScreenshotPath;
      }

      return {
        ...submission,
        screenshotPath: finalScreenshotPath,
      };
    }, { headless: process.env.HEADLESS === "true" });

    // 5. Update Database upon successful/failed submission
    if (submitResult.success) {
      console.log("✅ [Worker]: Application submitted successfully!");
      await db.query(
        `UPDATE applications 
         SET status = 'SUBMITTED', 
             submitted_at = datetime('now'), 
             confirmation = $2, 
             screenshot_path = $3,
             updated_at = datetime('now') 
         WHERE id = $1`,
        [applicationId, submitResult.confirmation || "SUCCESS", submitResult.screenshotPath]
      );
      await logApplicationEvent(applicationId, "SUBMITTED", { 
        confirmation: submitResult.confirmation,
        screenshotPath: submitResult.screenshotPath 
      });
      
      // Trigger console notification representing Step 22 event emitter
      console.log(`🔔 [NOTIFICATION]: Application for ${url} has been SUBMITTED successfully!`);
    } else {
      // Submission failed or validation failed. Update status to FAILED, record the error and screenshot path
      await db.query(
        `UPDATE applications 
         SET status = 'FAILED', 
             error_message = $2, 
             screenshot_path = $3,
             updated_at = datetime('now') 
         WHERE id = $1`,
        [applicationId, submitResult.errorMessage || "SUBMISSION_FAILED", submitResult.screenshotPath]
      );
      throw new Error(submitResult.errorMessage || "SUBMISSION_FAILED");
    }

  } catch (error: any) {
    console.error(`❌ [Worker]: Job execution failed for application [${applicationId}]:`, error.message);
    
    let failureReason = error.message;
    if (error.message.includes("USER_PROFILE_NOT_FOUND")) failureReason = "USER_PROFILE_NOT_FOUND";
    else if (error.message.includes("ACTIVE_RESUME_NOT_FOUND")) failureReason = "RESUME_UPLOAD_FAILED";
    else if (error.message.includes("VALIDATION_FAILED")) failureReason = "VALIDATION_FAILED";
    else if (error.message.includes("ATS_NOT_SUPPORTED")) failureReason = "ATS_NOT_SUPPORTED";
    else if (error.message.includes("SUBMISSION_FAILED")) failureReason = "SUBMISSION_FAILED";
    
    // Update Database status
    await db.query(
      `UPDATE applications 
       SET status = 'FAILED', 
           error_message = $2, 
           updated_at = datetime('now') 
       WHERE id = $1`,
      [applicationId, error.message]
    );
    await logApplicationEvent(applicationId, "FAILED", { 
      reason: failureReason,
      details: error.message 
    });
  } finally {
    if (isResumeTemp && resumePath && fs.existsSync(resumePath)) {
      try {
        await fs.promises.unlink(resumePath);
        console.log(`🧹 Cleaned up temporary resume file: ${resumePath}`);
      } catch (err: any) {
        console.warn(`⚠️ Failed to delete temporary resume file: ${resumePath}`, err.message);
      }
    }
  }
}
