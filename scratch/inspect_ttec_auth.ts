import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Accept agreement
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  // Instead of guest, what buttons are on this login screen?
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input[type='button'], input[type='submit'], button, a")).map(b => ({
      tag: b.tagName,
      id: b.id,
      value: (b as any).value || b.textContent?.trim(),
      type: (b as any).type
    })).filter(x => x.value);
  });

  console.log("LOGIN PAGE BUTTONS:", JSON.stringify(buttons, null, 2));
  await browser.close();
}

main().catch(console.error);

