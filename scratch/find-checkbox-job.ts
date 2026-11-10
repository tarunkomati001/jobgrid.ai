import { chromium } from "playwright";

const urls = [
  "https://jobs.jobvite.com/actionet/job/oAd3Afwa/apply",
  "https://jobs.jobvite.com/actionet/job/oVq9AfwO/apply",
  "https://jobs.jobvite.com/iboss/job/oLudAfwM/apply",
  "https://jobs.jobvite.com/enverus/job/oUSzAfwF/apply"
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  for (const url of urls) {
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2000);
      const text = await page.innerText("body").catch(() => "");
      console.log(`URL: ${url}`);
      console.log("Has Applicant Screening Questions?", text.includes("Applicant Screening Questions"));
      console.log("Has require sponsorship?", text.includes("require sponsorship"));
      await page.close();
    } catch (e: any) {
      console.log(`Error on ${url}:`, e.message);
    }
  }
  await browser.close();
}

run();

