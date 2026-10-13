import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `test_pin_vadodara_${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  // Set country to India
  const countryInp = page.locator("input#country-12, input[name='country']").first();
  if (await countryInp.count() > 0) {
    await page.evaluate(() => {
      const r = document.getElementById("country-12-reset-button") as HTMLElement;
      if (r) r.click();
    });
    await page.waitForTimeout(400);

    await countryInp.click();
    await countryInp.fill("India");
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("#country-12-listbox [role='option'], [role='option'], .cx-select__list-item"));
      const india = opts.find(o => o.textContent?.trim().toLowerCase() === "india");
      if (india) (india as HTMLElement).click();
    });
    await page.waitForTimeout(1500);
  }

  // Type 390 in Pin Code
  const pin = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await pin.count() > 0) {
    console.log("Typing 390 into Pin Code...");
    await pin.click();
    await pin.fill("390");
    await page.waitForTimeout(1500);

    const opts = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item, .cx-autocomplete__list-item, li"));
      return items.map(i => i.textContent?.trim() || "").filter(t => t.toUpperCase().includes("VADODARA"));
    });
    console.log("Vadodara options when typing 390:", opts);

    // Select the first Vadodara option
    const clicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item, .cx-autocomplete__list-item, li"));
      const match = items.find(i => (i.textContent || "").toUpperCase().includes("VADODARA"));
      if (match) {
        (match as HTMLElement).click();
        return match.textContent?.trim();
      }
      return null;
    });
    console.log("Clicked Vadodara option:", clicked);
    await page.waitForTimeout(1000);
    console.log("Pin input value after click:", await pin.inputValue());
  }

  await page.screenshot({ path: "scratch/pin_vadodara_success.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
