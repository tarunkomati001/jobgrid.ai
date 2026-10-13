import { db } from "../database/db";
import { chromium } from "playwright";
import { applyStealthScripts, createBrowser } from "../browser/browser-manager";
import { AshbyAdapter } from "../ats/ashby/ashby.adapter";
import { UserProfile } from "../ats/ats.interface";
import { resolveLocalResumePath } from "../utils/path-resolver";

async function runAll11ParallelHeaded() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║         ⚡ CLUCO.AI AUTO-PILOT : 11 INSTANT PARALLEL HEADED FILLING    ║
║      Opening ALL 11 Tabs Simultaneously in Browser at Once             ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  process.env.DRY_RUN = "true"; // Simulation / Dry-run mode - autofills everything and leaves forms ready for manual submission

  // 1. Fetch Hrutin Nammi profile from DB
  let profileRes = await db.query(
    "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id WHERE u.email = 'babufakemail@gmail.com'"
  );

  if (profileRes.rowCount === 0) {
    profileRes = await db.query(
      "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id ORDER BY p.user_id DESC LIMIT 1"
    );
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

  const resumeRes = await db.query(
    "SELECT file_path FROM resumes WHERE user_id = $1 AND is_active = 1",
    [profile.userId]
  );
  const rawResumePath = resumeRes.rowCount > 0 ? resumeRes.rows[0].file_path : `resumes/user_${profile.userId}/Midde_Chetan_Sai_Resume.pdf`;
  const resumePath = resolveLocalResumePath(rawResumePath);

  // 2. Fetch all 11 job URLs from DB
  const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE url != 'https://ashbyhq.com/test-job' ORDER BY url ASC");
  const urls: string[] = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));

  console.log(`📋 Loaded ${urls.length} job application URLs for INSTANT simultaneous tab opening.\n`);
  console.log(`👤 Candidate: ${profile.firstName} ${profile.lastName} (${profile.email})`);
  console.log(`📄 Resume: ${resumePath}\n`);

  // 3. Launch single Microsoft Edge Browser with maximize window
  console.log("🚀 Launching Headed Microsoft Edge Browser...");
  const browser = await createBrowser(false);

  const context = await browser.newContext({ viewport: null });

  console.log(`⚡ INSTANTLY CREATING ALL ${urls.length} BROWSER TABS AT ONCE...`);

  await applyStealthScripts(context);

  // Create ALL 11 tabs immediately at the exact same moment
  const tabObjects = await Promise.all(
    urls.map(async (url, idx) => {
      const page = await context.newPage();
      console.log(` 🚀 [Tab ${idx + 1}/${urls.length}] Created tab in browser UI.`);
      return { page, url, idx: idx + 1 };
    })
  );

  console.log(`\n🔥 ALL ${urls.length} TABS ARE NOW OPEN IN THE BROWSER! Starting parallel form filling...\n`);

  const startTime = Date.now();

  // Run all 11 job autofills in parallel on the already open tabs
  const results = await Promise.all(
    tabObjects.map(async ({ page, url, idx }) => {
      try {
        console.log(`🌐 [Tab ${idx}/${urls.length}] Navigating to: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 }).catch(() => {});
        await page.waitForTimeout(500);

        const adapter = new AshbyAdapter();
        const extractedFields = await adapter.extractFields(page);

        // Upload Resume
        await adapter.uploadResume(page, resumePath, extractedFields);

        // Fill Form
        await adapter.fillForm(page, profile, {}, extractedFields);

        // Validate
        await adapter.validate(page, extractedFields);

        // Live Submit
        const subResult = await adapter.submit(page);

        console.log(`✅ [Tab ${idx}/${urls.length}] Completed processing for ${url}`);
        return {
          idx,
          url,
          success: subResult.success,
          notice: subResult.confirmation || subResult.errorMessage
        };
      } catch (err: any) {
        console.error(`❌ [Tab ${idx}/${urls.length}] Error processing ${url}: ${err.message}`);
        return {
          idx,
          url,
          success: false,
          notice: err.message
        };
      }
    })
  );

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n===============================================================================");
  console.log(`🎉 ALL 11 INSTANT PARALLEL JOB APPLICATIONS COMPLETED IN ${durationSec} SECONDS!`);
  console.log("===============================================================================\n");

  console.log("📊 PARALLEL APPLICATION SUMMARY:");
  results.forEach(res => {
    console.log(`  [Tab ${res.idx}/11] ${res.success ? "✅ SUBMITTED" : "❌ FAILED"} | URL: ${res.url}`);
    if (res.notice) console.log(`          Notice/Error: ${res.notice}`);
  });

  console.log("\n📌 All 11 browser tabs are kept open on screen for your review!");
  await db.close();
}

runAll11ParallelHeaded();
