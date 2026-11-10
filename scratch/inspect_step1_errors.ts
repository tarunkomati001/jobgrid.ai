import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Click Next Step directly and inspect errors
  const nextBtn = page.locator("button:has-text('Next Step')").first();
  await nextBtn.click();
  await page.waitForTimeout(2000);

  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".has-error, [style*='color: red'], [style*='color: rgb(220'], .field-validation-error, span:has-text('Required')")).map(el => ({
      tagName: el.tagName,
      className: el.className,
      text: (el as HTMLElement).innerText?.trim()
    }));
  });
  console.log("ERRORS ON STEP 1:", JSON.stringify(errors, null, 2));

  await browser.close();
}

main();

