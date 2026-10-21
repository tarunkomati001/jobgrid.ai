import { chromium } from "playwright";

async function inspectQ12() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of [
    "https://ats.rippling.com/en-GB/rippling/jobs/94486f41-6474-446a-b67a-c164e11354ea",
    "https://ats.rippling.com/en-GB/rippling/jobs/1584be38-83a9-41a8-94e8-f733332ace4e"
  ]) {
    console.log(`\n======================================================`);
    console.log(`Inspecting: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const applyBtn = page.locator("button:has-text('Apply now')").first();
    if (await applyBtn.count() > 0) {
      await applyBtn.click();
      await page.waitForTimeout(1500);
    }

    const field12 = page.locator("div[data-testid='field']").nth(12);
    const text = await field12.innerText().catch(() => "");
    const html = await field12.innerHTML().catch(() => "");
    console.log("Field 12 innerText:", text);
    console.log("Field 12 innerHTML:", html);

    // Let's click combobox in field 12 and see options
    const combobox = field12.locator("[role='combobox']").first();
    if (await combobox.count() > 0) {
      await combobox.click();
      await page.waitForTimeout(500);
      const options = await page.evaluate(() => {
        const opts = Array.from(document.querySelectorAll("[role='option'], [class*='option'], [class*='Option'], [data-testid*='option']"));
        return opts.map(o => o.textContent?.trim());
      });
      console.log("Options for Field 12 combobox:", options);
      // Close dropdown by pressing Escape
      await page.keyboard.press("Escape");
    }

    // Also inspect Location input
    const locationInput = page.locator("input[data-testid='input-undefined'], div:has(> span[id$='-label']:has-text('Location')) input").first();
    if (await locationInput.count() > 0) {
      console.log("Found Location input. Testing typing 'San Francisco'...");
      await locationInput.click();
      await locationInput.fill("");
      await locationInput.pressSequentially("San Francisco, CA", { delay: 50 });
      await page.waitForTimeout(1500);
      const locOptions = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll("[role='option'], [class*='item'], [class*='Item'], [class*='suggestion'], [class*='Suggestion']"));
        return items.map(o => o.textContent?.trim()).filter(Boolean).slice(0, 5);
      });
      console.log("Location suggestions:", locOptions);
    }
  }

  await browser.close();
}

inspectQ12().catch(console.error);
