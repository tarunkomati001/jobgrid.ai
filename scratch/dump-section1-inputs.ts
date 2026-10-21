import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_inspect_${Date.now()}@gmail.com`;
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.click("label[for='legal-disclaimer-checkbox']");
  await page.click("button:has-text('Next')");

  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select")).map(el => {
      const parent = el.closest(".input-field, .geo-hierarchy-form-element, .form-block, div");
      const label = parent?.querySelector("label, .input-field__label")?.textContent?.trim();
      return {
        tag: el.tagName,
        id: el.id,
        name: (el as any).name,
        type: (el as any).type,
        role: el.getAttribute("role"),
        value: (el as any).value,
        ariaLabel: el.getAttribute("aria-label"),
        labelText: label
      };
    });
  });

  console.log("ALL SECTION 1 INPUTS:\n", JSON.stringify(inputs, null, 2));
  await browser.close();
}

main().catch(console.error);
