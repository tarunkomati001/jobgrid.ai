import { chromium } from "playwright";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  const url = "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597";
  console.log(`Starting Paylocity test on: ${url}...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      break;
    } catch (e: any) {
      console.warn(`Attempt ${attempt} failed: ${e.message}, retrying...`);
      await page.waitForTimeout(3000);
      if (attempt === 3) throw e;
    }
  }
  await page.waitForTimeout(3000);

  const adapter = new PaylocityAdapter();
  await adapter.fillForm(page, profile);

  console.log("Paylocity fillForm completed!");
  console.log("Current URL:", page.url());
  console.log("Current Title:", await page.title());
  await page.screenshot({ path: "scratch/paylocity_behavioral_success.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
