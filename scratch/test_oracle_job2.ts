import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  const url = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
  console.log(`Starting Oracle test on: ${url}...`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  const adapter = new OracleAdapter();
  await adapter.fillForm(page, profile);

  console.log("Oracle fillForm completed!");
  console.log("Final URL:", page.url());
  console.log("Final Title:", await page.title());
  await page.screenshot({ path: "scratch/oracle_344557_result.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

