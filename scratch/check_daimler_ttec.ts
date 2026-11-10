import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const urls = [
    "https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER00045QI&lang=en",
    "https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP"
  ];

  for (const u of urls) {
    try {
      console.log(`Checking ${u}...`);
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(3000);
      console.log(" -> Final URL:", page.url());
      console.log(" -> Title:", await page.title());
    } catch (e: any) {
      console.log(" -> Failed:", e.message);
    }
  }

  await browser.close();
}

main();

