import { chromium } from "playwright";

async function testIndiaJob() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const url = "https://careers.oracle.com/en/sites/jobsearch/job/336378/apply/email";
  console.log("Navigating directly to apply email URL:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  console.log("Final URL:", page.url());
  const hasEmail = await page.$("input#primary-email-1, input[type='email']");
  console.log("Has email input:", !!hasEmail);

  await browser.close();
}

testIndiaJob().catch(console.error);
