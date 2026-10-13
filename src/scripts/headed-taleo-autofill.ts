import { db } from "../database/db";
import { chromium, Page } from "playwright";
import { TaleoAdapter } from "../ats/taleo/taleo.adapter";
import { UserProfile } from "../ats/ats.interface";
import path from "path";
import fs from "fs";

const TALEO_JOBS = [
  { rid: "4937", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4937" },
  { rid: "5005", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5005" },
  { rid: "5006", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5006" },
  { rid: "4985", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4985" },
  { rid: "5008", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008" },
  { rid: "5009", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5009" },
  { rid: "5010", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5010" }
];

async function fillSingleJobInTab(
  page: Page,
  job: { rid: string, url: string },
  tabIndex: number,
  totalJobs: number,
  profile: UserProfile,
  resumePath: string,
  isAutoSubmit: boolean
) {
  const adapter = new TaleoAdapter();

  console.log(`\n======================================================`);
  console.log(`🌐 [Tab ${tabIndex}/${totalJobs}] Opening in New Tab: RID=${job.rid}`);
  console.log(`URL: ${job.url}`);
  console.log(`======================================================\n`);

  try {
    await page.goto(job.url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (bodyText.includes("no longer available") || bodyText.includes("has moved")) {
      console.warn(`⚠️ [Tab ${tabIndex}] Job RID=${job.rid} is closed/no longer available on Taleo.`);
      return;
    }

    // Extract Job details
    const jobDetails = await adapter.extractJob(page);
    console.log(`💼 [Tab ${tabIndex}] Job: "${jobDetails.title}" at ${jobDetails.company}`);

    // Fill Form across all steps
    await adapter.fillForm(page, profile, {
      password: process.env.TALEO_PASSWORD || "Tarun@2006",
      resumePath
    });

    // Upload Resume
    if (fs.existsSync(resumePath)) {
      await adapter.uploadResume(page, resumePath);
    }

    // Take verification screenshot of filled application
    const screenshotDir = path.resolve(__dirname, "../../scratch");
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    const screenshotPath = path.resolve(screenshotDir, `taleo_job_${job.rid}_tab_${tabIndex}_verified.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 [Tab ${tabIndex}] Saved screenshot to: ${screenshotPath}`);

    // Validate
    const isValid = await adapter.validate(page);
    console.log(`🔍 [Tab ${tabIndex}] Validation: ${isValid ? "PASSED (Ready to submit)" : "REVIEW NEEDED"}`);

    // Update DB application status
    try {
      const appStatus = isAutoSubmit && isValid ? "SUBMITTED" : (isValid ? "MANUAL_REVIEW" : "IN_PROGRESS");
      const jobCheck = await db.query(`SELECT id FROM jobs WHERE url = $1`, [job.url]);
      let jobId = jobCheck.rows[0]?.id;
      if (!jobId) {
        jobId = `job_taleo_${job.rid}`;
        await db.query(
          `INSERT INTO jobs (id, url, company, title, description, ats, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'TALEO', 'OPEN', NOW())
           ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title RETURNING id`,
          [jobId, job.url, jobDetails.company || "Base-2 Solutions", jobDetails.title || `Taleo Job ${job.rid}`, jobDetails.description || "Taleo job requisition"]
        );
      }

      const resumeCheck = await db.query(`SELECT id FROM resumes WHERE user_id = $1 LIMIT 1`, [profile.userId]);
      const resumeId = resumeCheck.rows[0]?.id || `res_${profile.userId}`;

      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status, screenshot_path, updated_at, created_at)
         VALUES ($1, $2, $3, $4, 'TALEO', $5, $6, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE 
         SET status = EXCLUDED.status, screenshot_path = EXCLUDED.screenshot_path, updated_at = NOW()`,
        [`app_${profile.userId}_${job.rid}`, profile.userId, jobId, resumeId, appStatus, screenshotPath]
      );
      console.log(`💾 [Tab ${tabIndex}] Updated DB application status to: ${appStatus}`);
    } catch (dbErr: any) {
      console.warn(`[Tab ${tabIndex}] Note: Could not update DB application status: ${dbErr.message}`);
    }

    if (isAutoSubmit && isValid) {
      console.log(`🚀 [Tab ${tabIndex}] Auto-submitting application...`);
      const result = await adapter.submit(page);
      console.log(`[Tab ${tabIndex}] Result:`, result);
    } else {
      console.log(`📌 [Tab ${tabIndex}] Tab kept open at Step 4 (Review & Submit) for user inspection.`);
    }

  } catch (err) {
    console.error(`❌ [Tab ${tabIndex}] Error on job ${job.rid}:`, err);
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║         ⚡ CLUCO.AI MULTI-TAB AUTOFILL : TALEO ATS APPLICATIONS         ║
║   Candidate: Hrutin Nammi | Each Job Opens In Its Own Separate Tab      ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  const args = process.argv.slice(2);
  const isHeadless = args.includes("--headless");
  const isAutoSubmit = args.includes("--auto-submit") || args.includes("--submit");
  const isParallel = args.includes("--parallel");
  const shouldClose = args.includes("--close");

  const jobFilterIdx = args.indexOf("--jobs");
  let targetJobs = TALEO_JOBS;
  if (jobFilterIdx !== -1 && args[jobFilterIdx + 1]) {
    const rids = args[jobFilterIdx + 1].split(",").map(r => r.trim());
    targetJobs = TALEO_JOBS.filter(j => rids.includes(j.rid));
  } else if (args.includes("--new-only")) {
    targetJobs = TALEO_JOBS.slice(0, 3);
  }

  // 1. Fetch Candidate Hrutin Nammi from DB
  console.log("👤 Fetching candidate Hrutin Nammi from database...");
  const userRes = await db.query(
    "SELECT u.id, u.email, p.* FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.email LIKE '%hrutin%' OR p.first_name ILIKE '%hrutin%' OR u.email = 'babufakemail@gmail.com' LIMIT 1"
  );

  let user: any = null;
  if (userRes.rowCount && userRes.rowCount > 0) {
    user = userRes.rows[0];
  } else {
    user = {
      first_name: "Hrutin",
      last_name: "Nammi",
      email: "babufakemail@gmail.com",
      phone: "8688423267",
      location: "Vadodara, Gujarat, India",
      linkedin_url: "https://linkedin.com/in/hrutinnammi",
      github_url: "https://github.com/hrutinnammi"
    };
  }

  console.log(`✅ Loaded Candidate: ${user.first_name} ${user.last_name} (${user.email})`);

  // Resolve Resume
  const resumePath = path.resolve(__dirname, "../../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log(`📄 Resume Path: ${resumePath} (exists: ${fs.existsSync(resumePath)})`);

  const profile: UserProfile = {
    userId: user.user_id || "usr_hrutin_nammi",
    firstName: user.first_name || "Hrutin",
    middleName: user.middle_name || "Goud",
    lastName: user.last_name || "Nammi",
    email: user.email || "babufakemail@gmail.com",
    phone: user.phone || "8688423267",
    location: "ava street, vadodar, Gujarat, 390144, India",
    street: "ava street",
    city: "vadodar",
    state: "Gujarat",
    zipCode: "390144",
    country: "India",
    linkedinUrl: user.linkedin_url || "https://linkedin.com/in/hrutinnammi",
    githubUrl: user.github_url || "https://github.com/hrutinnammi",
    portfolioUrl: user.portfolio_url || "https://github.com/hrutinnammi",
    workAuthorization: "Authorized to Work",
    willingToRelocate: true,
    yearsOfExperience: 2
  };

  console.log(`🚀 Launching ${isHeadless ? "Headless" : "Headed"} Browser...`);
  const browser = await chromium.launch({
    headless: isHeadless,
    args: ["--start-maximized"]
  });

  const context = await browser.newContext({
    viewport: null, // lets window fill screen in headed mode
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  if (isParallel) {
    console.log(`⚡ PARALLEL MODE: Opening all ${targetJobs.length} tabs simultaneously...`);
    await Promise.all(
      targetJobs.map(async (job, idx) => {
        const page = await context.newPage();
        await fillSingleJobInTab(page, job, idx + 1, targetJobs.length, profile, resumePath, isAutoSubmit);
      })
    );
  } else {
    console.log(`🎯 MULTI-TAB MODE: Opening each job in a new tab...`);
    for (let i = 0; i < targetJobs.length; i++) {
      const page = await context.newPage();
      await fillSingleJobInTab(page, targetJobs[i], i + 1, targetJobs.length, profile, resumePath, isAutoSubmit);
    }
  }

  console.log("\n======================================================");
  console.log("🎉 ALL TALEO APPLICATIONS COMPLETED IN INDIVIDUAL TABS!");
  if (!shouldClose && !isHeadless) {
    console.log("📌 Keeping all tabs open on screen for your review.");
    console.log("======================================================\n");
  } else {
    console.log("🔒 Closing browser.");
    console.log("======================================================\n");
    await browser.close();
  }

  await db.close();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.close();
});
