import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(4000);
  }

  const guestBtn = page.locator("input[id*='guestapply'], input[value='Apply as Guest']").first();
  if (await guestBtn.isVisible()) {
    await guestBtn.click();
    await page.waitForTimeout(3000);
  }

  console.log("Entering guest email...");
  const emInput = page.locator("input[id*='email']").first();
  await emInput.fill("babufakemail@gmail.com");

  const contBtn = page.locator("input[id*='continue'], input[value='Continue']").first();
  await contBtn.click();
  await page.waitForTimeout(5000);

  console.log("URL after guest email:", page.url());
  console.log("Title after guest email:", await page.title());

  const fields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      text: el.textContent?.trim().slice(0, 30),
      label: document.querySelector(`label[for='${el.id}']`)?.textContent?.trim() || ""
    })).filter(x => x.id || x.name || x.label || x.text);
  });
  console.log("Wizard Step 1 elements on TTEC:", JSON.stringify(fields.slice(0, 25), null, 2));
  await page.screenshot({ path: "scratch/ttec_wizard_step1.png" });
  await browser.close();
}

main();

