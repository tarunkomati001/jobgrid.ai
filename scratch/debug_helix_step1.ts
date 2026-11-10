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

  console.log("URL:", page.url());

  // Fill email and passwords
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "TestPass123!@#");
  await page.fill("input[name='cwsPassword_2']", "TestPass123!@#");

  // Dump all visible inputs and buttons on step 1
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button, a")).map(el => ({
      tag: el.tagName,
      name: (el as any).name,
      id: el.id,
      type: (el as any).type,
      text: el.textContent?.trim()?.slice(0, 50),
      className: el.className
    })).filter(x => x.name || x.id || x.text);
  });
  console.log("Step 1 elements:", JSON.stringify(inputs.slice(0, 15), null, 2));

  // Click next arrow
  const nextArrow = page.locator(".oracletaleocwsv2-arrow-nav-next, button:has-text('Next'), a:has-text('Next')").first();
  console.log("Next arrow count:", await nextArrow.count());
  await nextArrow.click({ force: true });
  await page.waitForTimeout(4000);

  console.log("After next click URL:", page.url());
  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".error, .text-danger, .oracletaleocwsv2-error-text, .alert, [class*='error']")).map(e => e.textContent?.trim()).filter(Boolean);
  });
  console.log("Errors after click:", errors);

  await page.screenshot({ path: "scratch/helix_step1_error.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

