import { chromium } from "playwright";

const URLS = [
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4812",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4679"
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of URLS) {
    await page.goto(url, { waitUntil: "networkidle" });
    const info = await page.evaluate(() => {
      const strongTitle = document.querySelector(".oracletaleocwsv2-job-description strong, .well strong")?.textContent?.trim() || "";
      const desc = document.querySelector(".oracletaleocwsv2-job-description, .cws-view-requisition-description")?.textContent?.trim() || "";
      return { strongTitle, descSnippet: desc.slice(0, 150) };
    });
    console.log(url, info);
  }

  await browser.close();
}

main().catch(console.error);
