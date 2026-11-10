import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  const url = "https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZO";
  console.log(`Starting Taleo test on: ${url}...`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const adapter = new TaleoAdapter();
  await adapter.fillForm(page, profile);

  console.log("Taleo 04EZO fillForm completed!");
  console.log("Final URL:", page.url());
  console.log("Final Title:", await page.title());
  await page.screenshot({ path: "scratch/ttec_04EZO_result.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

