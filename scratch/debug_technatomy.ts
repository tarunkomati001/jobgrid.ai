import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const url = "https://phe.tbe.taleo.net/phe02/ats/careers/v2/viewRequisition?org=TECHNATOMY&cws=38&rid=2771";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("Title:", await page.title());
  const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first();
  console.log("Apply button count:", await applyBtn.count());
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }
  console.log("Post apply URL:", page.url());

  // Fill register fields
  if (await page.locator("input[name='email']").count() > 0) {
    await page.fill("input[name='email']", "babufakemail@gmail.com");
  }
  if (await page.locator("input[name='cwsPassword']").count() > 0) {
    await page.fill("input[name='cwsPassword']", "TestPass123!@#");
  }
  if (await page.locator("input[name='cwsPassword_2']").count() > 0) {
    await page.fill("input[name='cwsPassword_2']", "TestPass123!@#");
  }

  const nextArrow = page.locator("a.oracletaleocwsv2-arrow-nav-next:visible, button.oracletaleocwsv2-arrow-nav-next:visible").first();
  if (await nextArrow.count() > 0) {
    await nextArrow.click({ force: true });
    await page.waitForTimeout(4000);
  }

  console.log("Step 2 URL:", page.url());
  const step2 = await page.evaluate(() => {
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
  console.log("Technatomy Step 2:", JSON.stringify(step2, null, 2));

  await browser.close();
}

main().catch(console.error);

