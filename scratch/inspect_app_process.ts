import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/ApplicationProcess?jobId=8611", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("URL:", page.url());
  console.log("Title:", await page.title());
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log("Body:", bodyText);

  await browser.close();
}

main();
