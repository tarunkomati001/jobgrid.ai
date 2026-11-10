import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";

async function main() {
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER0003OP8&lang=en";
  console.log(`Starting TaleoAdapter on Daimler job: ${url}...`);

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const adapter = new TaleoAdapter();
  await adapter.fillForm(page, profile);

  console.log("Completed fillForm for Taleo!");
  console.log("Final URL:", page.url());
  console.log("Final Title:", await page.title());
  await page.screenshot({ path: "scratch/taleo_e2e_final.png" });
  await browser.close();
}

main().catch(console.error);
