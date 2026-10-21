import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720";

  await page.goto(url, { waitUntil: "networkidle" });

  const rawHtml = await page.evaluate(() => {
    const main = document.querySelector("#content, .cws, form, body");
    return main ? main.innerText.slice(0, 1000) : "";
  });

  console.log("Raw text top 1000 chars:\n", rawHtml);
  await browser.close();
}

main().catch(console.error);
