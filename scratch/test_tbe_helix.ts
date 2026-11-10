import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  const url = "https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023";
  console.log("Navigating to Helix ESG:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(4000);
  }

  const adapter = new TaleoAdapter();
  await adapter.fillForm(page, profile);

  console.log("Taleo fillForm completed!");
  console.log("Final URL:", page.url());
  console.log("Final Title:", await page.title());
  await page.screenshot({ path: "scratch/helix_result.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
