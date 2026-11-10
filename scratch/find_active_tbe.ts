import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/searchResults?org=BASESOLU&cws=37", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const activeJobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='viewRequisition']")).map(a => ({
      title: a.textContent?.trim(),
      href: (a as HTMLAnchorElement).href
    }));
  });

  console.log("ACTIVE BASE-2 JOBS:", JSON.stringify(activeJobs.slice(0, 5), null, 2));
  await browser.close();
}

main().catch(console.error);

