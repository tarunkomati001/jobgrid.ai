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

  // Fill email and passwords
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "TestPass123!@#");
  await page.fill("input[name='cwsPassword_2']", "TestPass123!@#");

  // Click next arrow specifically
  const nextArrow = page.locator("a.oracletaleocwsv2-arrow-nav-next:visible, button.oracletaleocwsv2-arrow-nav-next:visible").first();
  console.log("Next arrow count:", await nextArrow.count());
  await nextArrow.click({ force: true });
  await page.waitForTimeout(4000);

  console.log("After next click URL:", page.url());
  console.log("After next click Title:", await page.title());

  // Check what step is active
  const activeStep = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    return {
      id: active?.id,
      title: active?.querySelector(".oracletaleocwsv2-step-title, h1, h2")?.textContent?.trim(),
      fields: Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(el => ({
        tag: el.tagName,
        name: (el as any).name,
        type: (el as any).type,
        label: el.closest("div, p, label")?.querySelector("label")?.textContent?.trim() || (el as any).name,
        options: el.tagName === "SELECT" ? Array.from((el as HTMLSelectElement).options).map(o => o.text.trim()) : undefined
      }))
    };
  });
  console.log("Active step details:", JSON.stringify(activeStep, null, 2));

  await page.screenshot({ path: "scratch/helix_step2.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

