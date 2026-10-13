import { chromium } from "playwright";

const JOB_IDS = ["344557", "344708", "345236", "338844"];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  for (const id of JOB_IDS) {
    const directUrl = `https://careers.oracle.com/en/sites/jobsearch/job/${id}/apply/email`;
    console.log(`\nTesting direct apply URL: ${directUrl}`);
    await page.goto(directUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("input#primary-email-1, input[type='email']", { timeout: 15000 })
      .then(() => console.log(`Job ${id}: Direct apply/email loaded successfully!`))
      .catch((e) => console.log(`Job ${id}: Wait error: ${e.message}`));
  }

  await browser.close();
}

main().catch(console.error);
