import { chromium } from "playwright";
import { applyStealthScripts, createBrowser } from "../src/browser/browser-manager";

async function testCountryAndPhoneFlow() {
  console.log("🚀 Testing 2-step Country Code selection + Phone filling sequence on Greenhouse...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2000);

  // STEP 1: Click and open Country Code dropdown
  console.log("STEP 1: Opening Country Code dropdown...");
  const countryControl = page.locator("#country, input[id*='country'], .iti__selected-country, [aria-labelledby*='country-label']").first();
  await countryControl.scrollIntoViewIfNeeded().catch(() => {});
  await countryControl.focus().catch(() => {});
  await countryControl.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);

  // STEP 2: Filter and click matching Country Code option ("United States +1" / "India +91")
  console.log("STEP 2: Selecting Country Code option...");
  await countryControl.fill("United States").catch(() => {});
  await page.waitForTimeout(400);

  const option = page.locator("[role='option'], .select__option, li.iti__country, div[class*='option']").filter({ hasText: /United States|\+1/i }).first();
  if (await option.count() > 0 && await option.isVisible().catch(() => false)) {
    await option.click({ force: true }).catch(() => {});
    console.log("  ✅ Selected Country Code option: 'United States +1'");
  } else {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    console.log("  ✅ Selected Country Code via ArrowDown+Enter");
  }
  await page.waitForTimeout(500);

  // STEP 3: Fill Phone Number into Phone input
  console.log("STEP 3: Populating Phone input box...");
  const phoneNumber = "(415) 555-0123";
  const phoneInput = page.locator("#phone, input[type='tel']").first();
  if (await phoneInput.count() > 0) {
    await phoneInput.focus();
    await phoneInput.click({ force: true });

    await page.evaluate(({ val }) => {
      const el = document.getElementById("phone") as HTMLInputElement;
      if (!el) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }, { val: phoneNumber });

    console.log(`  ✅ Populated Phone input: "${phoneNumber}"`);
  }

  console.log("\n🎉 Sequence Complete! Keeping browser open 10s to visually verify result...");
  await page.waitForTimeout(10000);
  await browser.close();
}

testCountryAndPhoneFlow().catch(console.error);
