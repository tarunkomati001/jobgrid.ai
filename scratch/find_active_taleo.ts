import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Searching Base-2 Solutions Taleo career center...");
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/jobSearch?org=BASESOLU&cws=37", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const jobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='viewRequisition']")).map(a => ({
      title: a.textContent?.trim(),
      href: (a as HTMLAnchorElement).href
    }));
  });
  console.log("ACTIVE BASE-2 TALEO JOBS:", JSON.stringify(jobs.slice(0, 10), null, 2));

  await browser.close();
}

main();

