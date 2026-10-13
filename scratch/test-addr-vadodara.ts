import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `hrutin_test_addr_${Date.now()}@gmail.com`;
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

  console.log("Setting Country to India...");
  const countryInp = page.locator("input#country-12, input[name='country']").first();
  if (await countryInp.count() > 0) {
    const currentVal = await countryInp.inputValue().catch(() => "");
    if (!currentVal.toLowerCase().includes("india")) {
      // Click reset
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
  }

  console.log("Testing Pin Code selection for Vadodara...");
  const pinInput = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await pinInput.count() > 0) {
    await pinInput.click();
    await pinInput.fill("390144");
    await page.waitForTimeout(1200);

    // Dump list options
    const listOpts = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item, .cx-autocomplete__list-item, li"));
      return opts.map(o => o.textContent?.trim()).filter(Boolean);
    });
    console.log("Pin Code Autocomplete options found:", listOpts.slice(0, 10));

    // Click option containing VADODARA
    const clicked = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item, .cx-autocomplete__list-item, li"));
      const match = opts.find(o => o.textContent?.toUpperCase().includes("VADODARA"));
      if (match) {
        (match as HTMLElement).click();
        return match.textContent?.trim();
      }
      return null;
    });
    console.log("Clicked option:", clicked);
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: "scratch/oracle_addr_vadodara_test.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
