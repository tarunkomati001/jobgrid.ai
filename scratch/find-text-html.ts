import { chromium } from "playwright";

async function findTextInHtml() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://jobs.jobvite.com/iboss/job/oLudAfwM/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const html = await page.content();
  const idx = html.indexOf("require sponsorship for employment Visa status");
  console.log("Index of question in HTML:", idx);
  if (idx !== -1) {
    console.log("Context around question:\n", html.slice(Math.max(0, idx - 300), idx + 500));
  } else {
    console.log("Not found in HTML!");
  }
  await browser.close();
}

findTextInHtml().catch(console.error);

