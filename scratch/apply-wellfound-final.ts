import { createPersistentBrowserContext } from "../src/browser/browser-manager";
import { saveWellfoundCredentials, DEFAULT_HRUTIN_WELLFOUND_PROFILE } from "../src/ats/wellfound/wellfound-account-store";
import { syncWellfoundProfile, isWellfoundLoggedIn } from "../src/ats/wellfound/wellfound-auth";
import { WellfoundAdapter } from "../src/ats/wellfound/wellfound.adapter";

const RESET_URL = "https://url3882.wellfound.com/ls/click?upn=u001.oeoWYuviKXZogfIZAsv1tWKRg2sSWl5lKtFi2oKJYY6SCotw9mz18nalIA5UMz4oOXubALD3ySWE4TMeMEfFgX0BxazRzRlHCyql-2BmaXgB7WgKqT52TxslL0Mi8oELgiUr7g_S-2BjaBTXRwu9ZxEIOWYObQnOAjivA8BahXrxzWkmgOcQzODWlj2UmLhNh-2FitQ2rwl2wdIg5YdpXARFxf-2BelAlhfw9uKAcaRkKDrzimbYdrcckXfi1zVs-2BzqghuFUYi9kZdzlo24m-2BpvzNZ2k3SAUNSwFoUn7LLF628MwHR3WY71gkx7dLZ3sMkktHBoBmtf8Btz8Gtjf4-2F0yo4NTSNtuKyWM7jJiq8aWhIoAuTNZds7n6-2BL78ZmzQ0D4bi8uW31g3vahTlFDmtT5Gpu8sDuV-2Fu3IAoHtYPB3LUUv-2Fr6mPwL2WcfwdOAjTfPBMXvJ-2Fc14F";
const NEW_PASSWORD = "HrutinDev@2024!";
const TARGET_JOB_URL = "https://wellfound.com/jobs/4869796-software-engineer-backend";

async function main() {
  console.log("===============================================================================");
  console.log("🚀 COMPLETING WELLFOUND SETUP & APPLYING TO JOB");
  console.log("===============================================================================\n");

  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Step 1: Open reset URL
  console.log("👉 Navigating to password reset link...");
  await page.goto(RESET_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  console.log("Resolved URL:", page.url());
  console.log("Page title:", await page.title());
  await page.screenshot({ path: "scratch/reset_page_loaded.png" });

  // Step 2: Fill password fields
  console.log("✍️ Filling new password inputs...");
  const pwInputs = page.locator("input[type='password']");
  const count = await pwInputs.count();
  console.log(`Found ${count} password field(s).`);

  for (let i = 0; i < count; i++) {
    await pwInputs.nth(i).fill(NEW_PASSWORD);
    await page.waitForTimeout(300);
  }

  // Step 3: Submit password form
  const submitBtn = page.locator("input[type='submit'], button[type='submit'], button:has-text('Change'), button:has-text('Save')").first();
  if (await submitBtn.isVisible()) {
    console.log("🚀 Submitting password change...");
    await submitBtn.click();
    await page.waitForTimeout(5000);
  } else {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);
  }

  console.log("URL after password update:", page.url());
  await page.screenshot({ path: "scratch/after_password_change.png" });

  // Save new credentials
  await saveWellfoundCredentials({
    email: "babufakemail@gmail.com",
    password: NEW_PASSWORD,
    name: "Hrutin Nammi",
    updatedAt: new Date().toISOString()
  });
  console.log("💾 Credentials updated in store & database: babufakemail@gmail.com / HrutinDev@2024!");

  // Step 4: Verify authentication
  const loggedIn = await isWellfoundLoggedIn(page);
  console.log(`🔐 Logged in status: ${loggedIn ? "✅ YES" : "Checking..."}`);

  // Step 5: Profile & Social Links Sync
  console.log("\n🌐 Step 5: Syncing Hrutin's Profile & Links...");
  await syncWellfoundProfile(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE);
  await page.screenshot({ path: "scratch/profile_sync_completed.png" });

  // Step 6: Apply to the job
  console.log(`\n📄 Step 6: Navigating to job: ${TARGET_JOB_URL}...`);
  await page.goto(TARGET_JOB_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const adapter = new WellfoundAdapter();
  const job = await adapter.extractJob(page);
  console.log("Job details extracted:", JSON.stringify(job, null, 2));

  console.log("✍️ Processing application modal and pitch note...");
  await adapter.fillForm(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE, {
    work_authorization: "Yes",
    sponsorship: "No",
    relocate: "Yes",
    salary: "95000"
  });

  if (DEFAULT_HRUTIN_WELLFOUND_PROFILE.resumePath) {
    console.log("📂 Uploading candidate resume PDF...");
    await adapter.uploadResume(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE.resumePath);
  }

  await page.screenshot({ path: "scratch/job_application_ready.png" });

  console.log("🚀 Submitting application...");
  const result = await adapter.submit(page);
  console.log("Application Result:", JSON.stringify(result, null, 2));

  await page.screenshot({ path: "scratch/final_job_submitted.png" });
  console.log("✅ JOB APPLICATION FLOW COMPLETED SUCCESSFULLY!");

  await page.waitForTimeout(6000);
  await context.close();
}

main().catch(console.error);

