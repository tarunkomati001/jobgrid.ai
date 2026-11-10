import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const url = "https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Find all buttons, inputs with type=submit or button, or a with role=button or href
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button'], a.btn, a[role='button'], .oracletaleocwsv2-navigation a, .oracletaleocwsv2-navigation button")).map(el => ({
      tag: el.tagName,
      type: (el as any).type,
      id: el.id,
      name: (el as any).name,
      className: el.className,
      text: el.textContent?.trim(),
      value: (el as any).value,
      visible: (el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
    }));
  });
  console.log("All navigation buttons:", JSON.stringify(buttons, null, 2));

  await browser.close();
}

main().catch(console.error);

