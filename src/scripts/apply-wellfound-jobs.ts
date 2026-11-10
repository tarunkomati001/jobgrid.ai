import { chromium } from "playwright";
import { createPersistentBrowserContext, applyStealthScripts, DEFAULT_USER_AGENT } from "../browser/browser-manager";
import { db } from "../database/db";
import {
  DEFAULT_HRUTIN_WELLFOUND_PROFILE,
  DEFAULT_HRUTIN_WELLFOUND_LINKS,
  getWellfoundCredentials
} from "../ats/wellfound/wellfound-account-store";
import { ensureWellfoundSession, syncWellfoundProfile, isWellfoundLoggedIn } from "../ats/wellfound/wellfound-auth";
import { WellfoundAdapter } from "../ats/wellfound/wellfound.adapter";

async function main() {
  console.log("===============================================================================");
  console.log("🚀 WELLFOUND BATCH APPLICATION RUNNER (HRUTIN NAMMI)");
  console.log("===============================================================================\n");

  const isHeaded = !process.argv.includes("--headless");
  const isLiveSubmit = process.argv.includes("--submit") || process.env.AUTO_SUBMIT === "true";

  if (isLiveSubmit) {
    process.env.DRY_RUN = "false";
    process.env.AUTO_SUBMIT = "true";
  }

  // 1. Collect target URLs from arguments or pending jobs from DB
  let targetUrls: string[] = process.argv.filter(arg => arg.startsWith("http://") || arg.startsWith("https://"));

  if (targetUrls.length === 0) {
    console.log("🔍 No direct URLs passed. Querying pending Wellfound jobs from database...");
    const res = await db.query(
      `SELECT j.id, j.url, j.title, j.company 
       FROM public.jobs j
       JOIN public.applications a ON j.id = a.job_id
       JOIN public.users u ON a.user_id = u.id
       WHERE j.ats = 'WELLFOUND' AND a.status = 'PENDING' AND u.email = 'babufakemail@gmail.com'
       ORDER BY j.created_at ASC`
    );

    targetUrls = res.rows.map(r => r.url);
  }

  if (targetUrls.length === 0) {
    console.log("ℹ️ No pending Wellfound jobs found. Providing defaults...");
    targetUrls = [
      "https://wellfound.com/jobs/4855345-senior-software-engineer-client-lifecycle",
      "https://wellfound.com/jobs/2952041-software-engineer"
    ];
  }

  console.log(`📋 Found ${targetUrls.length} Wellfound job(s) to process:`);
  targetUrls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
  console.log(`\n⚙️ Execution Settings: Headed=${isHeaded}, Mode=${isLiveSubmit ? "LIVE SUBMISSION" : "DRY-RUN (SIMULATION)"}\n`);

  // 2. Launch persistent browser context
  const context = await createPersistentBrowserContext(!isHeaded);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const shouldSyncProfile = process.argv.includes("--sync-profile");

  try {
    // If explicitly requested via flag, sync profile once
    if (shouldSyncProfile) {
      console.log("-------------------------------------------------------------------------------");
      console.log("Profile Sync Requested (--sync-profile)");
      console.log("-------------------------------------------------------------------------------");
      await syncWellfoundProfile(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE);
    }

    // Process job applications directly
    const adapter = new WellfoundAdapter();

    for (let i = 0; i < targetUrls.length; i++) {
      const jobUrl = targetUrls[i];
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎯 [Job ${i + 1}/${targetUrls.length}]: Navigating DIRECTLY to ${jobUrl}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      try {
        // Direct navigation to job URL without opening profile or login pages first
        await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(2500);

        // Verify session directly on the job page
        const isLoggedIn = await isWellfoundLoggedIn(page);
        if (!isLoggedIn) {
          console.log("🔐 Not logged in on job page. Restoring Wellfound session...");
          const creds = await getWellfoundCredentials(DEFAULT_HRUTIN_WELLFOUND_PROFILE.email);
          await ensureWellfoundSession(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE, creds || undefined);
          console.log(`👉 Returning directly to target job: ${jobUrl}...`);
          await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(2500);
        } else {
          console.log("✅ Authenticated session verified directly on job page.");
        }

        const jobDetails = await adapter.extractJob(page);
        console.log(`📄 Title: ${jobDetails.title}`);
        console.log(`🏢 Company: ${jobDetails.company}`);

        console.log("✍️ Filling application details, pitch, and questions directly on job page...");
        await adapter.fillForm(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE, {
          work_authorization: "Yes",
          sponsorship: "No",
          relocate: "Yes",
          salary: "95000"
        });

        if (DEFAULT_HRUTIN_WELLFOUND_PROFILE.resumePath) {
          console.log(`📂 Uploading resume: ${DEFAULT_HRUTIN_WELLFOUND_PROFILE.resumePath}...`);
          await adapter.uploadResume(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE.resumePath);
        }

        const safeFilename = `wf_job_${i + 1}_modal.png`;
        await page.screenshot({ path: `scratch/${safeFilename}` }).catch(() => {});

        console.log(`🚀 Finalizing application (${isLiveSubmit ? "LIVE SUBMIT" : "DRY-RUN SIMULATION"})...`);
        const result = await adapter.submit(page);
        console.log("🏁 Application Result:", JSON.stringify(result, null, 2));

        // Update database status
        await db.query(
          `UPDATE public.applications 
           SET status = $1, updated_at = CURRENT_TIMESTAMP
           FROM public.jobs j
           WHERE public.applications.job_id = j.id AND j.url = $2`,
          [isLiveSubmit ? "APPLIED" : "VERIFIED", jobUrl]
        ).catch(() => {});

        console.log(`✅ [Job ${i + 1}] processed successfully!`);
      } catch (jobErr: any) {
        console.error(`❌ [Job ${i + 1}] Error:`, jobErr.message);
        await page.screenshot({ path: `scratch/wf_job_${i + 1}_error.png` }).catch(() => {});
      }

      await page.waitForTimeout(2000);
    }

    console.log("\n🎉 ALL WELLFOUND JOBS PROCESSED SUCCESSFULLY!");
  } catch (err: any) {
    console.error("❌ Batch runner encountered an error:", err);
  } finally {
    console.log("Holding browser open for 6 seconds for inspection...");
    await page.waitForTimeout(6000);
    await context.close();
    await db.close();
  }
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.close();
  process.exit(1);
});

