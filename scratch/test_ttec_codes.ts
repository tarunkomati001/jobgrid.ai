import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const jobCodes = ["04EZP", "04EZO", "04EZQ", "04EZR", "04EZL", "04E9J"];
  for (const jc of jobCodes) {
    const u = `https://ttec.taleo.net/careersection/2/jobapply.ftl?job=${jc}`;
    try {
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);
      const title = await page.title();
      console.log(`Job ${jc}: title="${title}", URL: ${page.url()}`);
    } catch (e: any) {
      console.log(`Job ${jc} failed: ${e.message}`);
    }
  }

  await browser.close();
}

main();

