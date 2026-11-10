import { chromium } from "playwright";
import { AvatureAdapter } from "../src/ats/avature/avature.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";

async function main() {
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://cdcn.avature.net/careers/JobDetail/Caregiver-Dayton-Minden-Surrounding-Areas/9343";
  console.log(`Starting AvatureAdapter on active CDCN job: ${url}...`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const adapter = new AvatureAdapter();
  await adapter.fillForm(page, profile);

  console.log("Completed fillForm for Avature!");
  console.log("Final URL:", page.url());
  console.log("Final Title:", await page.title());
  await page.screenshot({ path: "scratch/avature_9343_final.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

