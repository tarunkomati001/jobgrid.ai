import { chromium } from "playwright";
import { createPersistentBrowserContext, DEFAULT_USER_AGENT, applyStealthScripts } from "../src/browser/browser-manager";
import { DEFAULT_HRUTIN_WELLFOUND_PROFILE, getWellfoundCredentials, saveWellfoundCredentials } from "../src/ats/wellfound/wellfound-account-store";
import { createWellfoundAccount, isWellfoundLoggedIn } from "../src/ats/wellfound/wellfound-auth";

async function main() {
  console.log("🚀 Starting Wellfound Account Creation Script...");
  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const creds = await getWellfoundCredentials(DEFAULT_HRUTIN_WELLFOUND_PROFILE.email) || {
    email: DEFAULT_HRUTIN_WELLFOUND_PROFILE.email,
    password: process.env.WELLFOUND_PASSWORD || "HrutinDev@2024!",
    updatedAt: new Date().toISOString()
  };

  console.log(`👤 Profile: ${DEFAULT_HRUTIN_WELLFOUND_PROFILE.firstName} ${DEFAULT_HRUTIN_WELLFOUND_PROFILE.lastName} (${creds.email})`);

  try {
    const success = await createWellfoundAccount(page, creds, DEFAULT_HRUTIN_WELLFOUND_PROFILE);
    console.log(`🏁 Account creation result: ${success ? "SUCCESS" : "FAILED"}`);
    await page.screenshot({ path: "scratch/wellfound_account_creation_result.png" });
  } catch (err: any) {
    console.error("❌ Error during account creation:", err);
    await page.screenshot({ path: "scratch/wellfound_account_creation_error.png" }).catch(() => {});
  } finally {
    console.log("Holding browser open for 10 seconds...");
    await page.waitForTimeout(10000);
    await context.close();
  }
}

main().catch(console.error);

