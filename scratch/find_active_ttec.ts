import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  await page.goto("https://ttec.taleo.net/careersection/2/jobsearch.ftl?lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const jobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='jobdetail.ftl?job=']")).map(a => ({
      title: a.textContent?.trim(),
      href: (a as HTMLAnchorElement).href.replace("jobdetail.ftl", "jobapply.ftl")
    }));
  });

  console.log("ACTIVE TTEC JOBS:", JSON.stringify(jobs.slice(0, 5), null, 2));
  await browser.close();
}

main().catch(console.error);
