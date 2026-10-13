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

  // Address
  await page.fill("input[name='address']", "ava street");
  await page.fill("input[name='city']", "vadodar");
  await page.fill("input[name='zipCode']", "390144");
  await page.selectOption("select[name='country']", "267");
  await page.waitForTimeout(1000);

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

  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  const errorDetails = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".has-error, .oracletaleocwsv2-error-field, [class*='error']")).map(el => ({
      tagName: el.tagName,
      className: el.className,
      text: el.textContent?.trim(),
      name: (el as any).name || (el.querySelector("input, select, textarea") as any)?.name
    }));
  });
  console.log("Error details:", JSON.stringify(errorDetails, null, 2));

  await browser.close();
}

main().catch(console.error);
