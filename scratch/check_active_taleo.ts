import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const urls = [
    "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5009",
    "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5010",
    "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4985"
  ];

  for (const u of urls) {
    try {
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(3000);
      const title = await page.title();
      const hasApply = await page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").count();
      console.log(`URL: ${u}\n -> Title: ${title}\n -> Has Apply Now button: ${hasApply > 0}\n`);
    } catch (e: any) {
      console.log(`URL: ${u} -> Failed: ${e.message}`);
    }
  }

  await browser.close();
}

main();

