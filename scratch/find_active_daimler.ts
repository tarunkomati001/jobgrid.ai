import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://tas-daimler.taleo.net/careersection/ex/jobsearch.ftl?lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const jobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='jobdetail.ftl'], a[href*='jobapply.ftl']")).map(a => ({
      text: a.textContent?.trim(),
      href: (a as any).href
    }));
  });
  console.log("Active Daimler jobs found:", jobs.slice(0, 5));
  await browser.close();
}

main();

