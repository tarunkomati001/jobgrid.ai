import { chromium } from "playwright";

const URLS = [
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer",
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location",
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/345236/?keyword=software+engineer",
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/338844/?keyword=software+engineers"
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\nChecking Job ${i + 1}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    const jobHeading = await page.locator("h1, h2").first().innerText().catch(() => "");
    console.log(`Job ${i + 1} Title: ${jobHeading} (${title})`);

    const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
    const hasApply = await applyBtn.count() > 0 && await applyBtn.isVisible();
    console.log(`Apply button present: ${hasApply}`);
  }

  await browser.close();
}

main().catch(console.error);
