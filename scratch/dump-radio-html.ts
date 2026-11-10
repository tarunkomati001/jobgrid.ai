import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function dumpRadioHtml() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://ats.rippling.com/clarity-clinic/jobs/6b7a4c6c-6c35-4d56-a90a-80a975b69ea5";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button:has-text('Apply now'), button:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  const radioContainerHtml = await page.evaluate(() => {
    const f = document.querySelectorAll("div[data-testid='field']")[12];
    return f ? f.innerHTML : "not found";
  });

  console.log("RADIO FIELD 12 INNER HTML:\n", radioContainerHtml);

  await browser.close();
}

dumpRadioHtml().catch(console.error);
