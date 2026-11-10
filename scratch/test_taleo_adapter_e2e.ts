import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testAdapter() {
  const adapter = new TaleoAdapter();
  const profile = HRUTIN_BLUEPRINT_PROFILE;

  const jobs = [
    {
      name: "Helix ESG",
      url: "https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023"
    },
    {
      name: "Technatomy",
      url: "https://phe.tbe.taleo.net/phe02/ats/careers/v2/viewRequisition?org=TECHNATOMY&cws=38&rid=2771"
    }
  ];

  for (const job of jobs) {
    console.log(`\n======================================================`);
    console.log(`🚀 TESTING TALEO ADAPTER: ${job.name}`);
    console.log(`======================================================`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 950 }
    });
    const page = await context.newPage();

    try {
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await adapter.fillForm(page, profile);
      console.log(`✅ [${job.name}] fillForm completed successfully! Final URL: ${page.url()}`);
      await page.screenshot({ path: `scratch/e2e_${job.name.toLowerCase().replace(/\s+/g, "_")}.png`, fullPage: true });
    } catch (err: any) {
      console.error(`❌ [${job.name}] Error:`, err.message);
    } finally {
      await browser.close();
    }
  }
}

testAdapter().catch(console.error);

