import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to Job 2:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill(`test_opts_${Date.now()}@gmail.com`);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
      if (l) (l as HTMLElement).click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(5000);

  // Click Gender toggle via evaluate
  console.log("Opening Gender dropdown via JS click...");
  await page.evaluate(() => {
    const btn = document.querySelector("button[id*='GENDER'][id*='toggle']") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
  const genderOpts = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[id*='GENDER'][id*='listbox'] .cx-select__list-item, .oj-listbox-result, [role='option'], li"));
    return items.map(i => i.textContent?.trim()).filter(Boolean);
  });
  console.log("Gender options:", genderOpts);

  // Click Veteran toggle via evaluate
  console.log("Opening Veteran dropdown via JS click...");
  await page.evaluate(() => {
    const btn = document.querySelector("button[id*='VETERAN'][id*='toggle']") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
  const vetOpts = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[id*='VETERAN'][id*='listbox'] .cx-select__list-item, .oj-listbox-result, [role='option'], li"));
    return items.map(i => i.textContent?.trim()).filter(Boolean);
  });
  console.log("Veteran options:", vetOpts);

  await browser.close();
}

main().catch(console.error);
