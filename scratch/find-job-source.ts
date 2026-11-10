import { chromium } from "playwright";

const urls = [
  "https://jobs.jobvite.com/iboss/job/oLudAfwM",
  "https://jobs.jobvite.com/iboss/job/orvdAfwt",
  "https://jobs.jobvite.com/iboss/job/ojdfAfw5",
  "https://jobs.jobvite.com/enverus/job/oUSzAfwF",
  "https://jobs.jobvite.com/actionet/job/oGlQAfwb",
  "https://jobs.jobvite.com/actionet/job/oATCAfwp"
];

async function findScreening() {
  const browser = await chromium.launch({ headless: true });
  for (const url of urls) {
    try {
      const page = await browser.newPage();
      await page.goto(url + "/apply", { timeout: 15000, waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const text = await page.textContent("body").catch(() => "");
      if (text.includes("Applicant Screening Questions") || text.includes("employment Visa status")) {
        console.log("MATCH FOUND ON URL:", url);
      }
      await page.close();
    } catch (e: any) {
      console.log("Error on", url, e.message);
    }
  }
  await browser.close();
}

findScreening().catch(console.error);

