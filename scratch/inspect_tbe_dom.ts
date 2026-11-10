import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectStep4() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });

  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);

  // Let's inspect the entire DOM of the page for work history elements!
  const htmlInfo = await page.evaluate(() => {
    const workEls = Array.from(document.querySelectorAll("[class*='work'], [id*='work'], [id*='WORK'], [class*='education'], [id*='education'], [id*='EDUCATION']"));
    return workEls.map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: el.textContent?.slice(0, 100).trim() || ""
    }));
  });

  console.log("Found work/education elements:", JSON.stringify(htmlInfo, null, 2));

  await browser.close();
}

inspectStep4().catch(console.error);

