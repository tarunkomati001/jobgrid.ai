import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { getUserProfile } from "../src/database/user-profile.service";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const profile = await getUserProfile("hrutin");
  const adapter = new PaylocityAdapter();

  console.log("Navigating to https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Run autofill
  await adapter.fillForm(page, profile);

  // Take screenshot of step 2 or whatever step it reached
  await page.screenshot({ path: "scratch/paylocity_step2_test.png", fullPage: true });
  console.log("Saved screenshot to scratch/paylocity_step2_test.png");

  await browser.close();
}

main().catch(err => {
  console.error("Error in test:", err);
  process.exit(1);
});

