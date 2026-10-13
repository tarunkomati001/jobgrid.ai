import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/jobs/preview/338844/?keyword=software+engineers", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("Job 338844 Title:", await page.title());
  console.log("Job 338844 URL:", page.url());
  const body = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log("Body:", body);
  await page.screenshot({ path: "scratch/job_338844.png" });
  await browser.close();
}

main().catch(console.error);
