import { chromium } from "playwright";

async function inspectNavDiv() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  await page.goto(url, { waitUntil: "networkidle" });

  const navHtml = await page.evaluate(() => {
    const el = document.querySelector(".oracletaleocwsv2-application-navigation");
    return el ? el.outerHTML : "NOT FOUND";
  });

  console.log("Navigation outerHTML:\n", navHtml);

  await browser.close();
}

inspectNavDiv().catch(console.error);
