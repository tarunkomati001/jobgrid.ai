import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Searching TTEC Taleo portal for jobs...");
  await page.goto("https://ttec.taleo.net/careersection/2/jobsearch.ftl", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const jobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='jobdetail.ftl'], a[href*='jobapply.ftl']")).map(a => ({
      title: a.textContent?.trim(),
      href: (a as HTMLAnchorElement).href
    }));
  });
  console.log("TTEC JOBS:", JSON.stringify(jobs.slice(0, 10), null, 2));

  await browser.close();
}

main();

