import { chromium } from "playwright";
import { applyStealthScripts, createBrowser } from "../src/browser/browser-manager";

async function testUSPhoneSelection() {
  console.log("🚀 Testing US Country Code & Phone filling on Greenhouse...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. Select Country dropdown ("United States +1")
  console.log("✍️ Selecting US Country Code (+1)...");
  const countryInput = page.locator("#country, input[id*='country'], .iti__selected-country, [aria-labelledby*='country']").first();
  if (await countryInput.count() > 0) {
    await countryInput.click({ force: true }).catch(() => {});
    await countryInput.fill("United States").catch(() => {});
    await page.waitForTimeout(400);

    const usOption = page.locator("[role='option'], .select__option, li.iti__country, div[class*='option']").filter({ hasText: /United States|\+1/i }).first();
    if (await usOption.count() > 0 && await usOption.isVisible().catch(() => false)) {
      await usOption.click({ force: true }).catch(() => {});
      console.log("✅ Clicked 'United States +1' option!");
    } else {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      console.log("✅ Selected country via ArrowDown+Enter!");
    }
  }

  // 2. Fill Phone Number
  console.log("✍️ Filling US phone number...");
  const phoneInput = page.locator("#phone, input[type='tel']").first();
  if (await phoneInput.count() > 0) {
    const phoneNumber = "(415) 555-0123";
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

    console.log(`✅ Filled phone number: ${phoneNumber}`);
  }

  console.log("🎉 Keeping browser open 10s to visually verify Country (+1) & Phone!");
  await page.waitForTimeout(10000);
  await browser.close();
}

testUSPhoneSelection().catch(console.error);
