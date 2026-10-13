import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008");
  
  await page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first().click();
  await page.waitForTimeout(3000);

  if (await page.locator("input[name='cwsPassword_2']").count() > 0) {
    await page.fill("input[name='email']", "babufakemail@gmail.com");
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.fill("input[name='cwsPassword_2']", "Tarun@2006");
    await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
    await page.waitForTimeout(3000);
  }

  if (page.url().includes("candidateLogin")) {
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.locator("button[name='login'], button:has-text('Login')").first().click();
    await page.waitForTimeout(4000);
  }

  // Fill the requested fields
  console.log("Filling address: ava street");
  await page.fill("input[name='address']", "ava street");
  
  console.log("Filling city: vadodar");
  await page.fill("input[name='city']", "vadodar");

  console.log("Filling zipCode: 390144");
  await page.fill("input[name='zipCode']", "390144");

  console.log("Selecting Country: India (267)");
  await page.selectOption("select[name='country']", "267");
  await page.waitForTimeout(1000);

  console.log("Setting State to Gujarat...");
  await page.evaluate(() => {
    const sel = document.querySelector("select[name='state']") as HTMLSelectElement;
    if (sel) {
      let opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("gujarat"));
      if (!opt) {
        opt = new Option("Gujarat", "Gujarat", true, true);
        sel.add(opt);
      }
      sel.value = "Gujarat";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  // Multiselect clearance
  const clearanceBtn = page.locator("button[aria-label='Security Clearance']").first();
  if (await clearanceBtn.count() > 0 && await clearanceBtn.isVisible()) {
    await clearanceBtn.click();
    await page.waitForTimeout(500);
    const noneOpt = page.locator(".oracletaleocwsv2-multiselect-popup label:has-text('None')").first();
    if (await noneOpt.count() > 0) {
      await noneOpt.click();
      await page.waitForTimeout(300);
    }
    const savePopup = page.locator(".oracletaleocwsv2-multiselect-popup a.oracletaleocwsv2-close-popup-trigger:has-text('Save')").first();
    if (await savePopup.count() > 0) {
      await savePopup.click();
      await page.waitForTimeout(500);
    }
  }

  // Click Next arrow
  console.log("Clicking Next arrow...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(4000);

  // Check if errors or next step
  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".alert-danger, .has-error, .error, [class*='error']"))
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 0 && !t.includes("error ="));
  });
  console.log("Errors if any:", errors);

  const activeStep = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    return active ? { id: active.id, text: active.textContent?.trim()?.slice(0, 100) } : null;
  });
  console.log("Active step after Next:", activeStep);

  await browser.close();
}

main().catch(console.error);
