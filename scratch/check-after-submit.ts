import { chromium } from "playwright";
import { getUserProfile } from "../src/database/user-profile.service";

async function checkAfterSubmit() {
  const profile = await getUserProfile("hrutin");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/Register?jobId=8611", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Country
  const countrySel = page.locator("select[id='170'], select[name*='country' i]").first();
  await countrySel.selectOption({ label: "United States" });
  await countrySel.evaluate((el: HTMLSelectElement) => el.dispatchEvent(new Event("change", { bubbles: true })));
  await page.waitForTimeout(1500);

  // State
  const stateSel = page.locator("select[id='169'], select[name*='state' i]").first();
  await stateSel.selectOption({ label: "California" });
  await stateSel.evaluate((el: HTMLSelectElement) => el.dispatchEvent(new Event("change", { bubbles: true })));

  // Text inputs
  await page.locator("input[id='162']").fill(profile.firstName);
  await page.locator("input[id='163']").fill(profile.lastName);
  await page.locator("input[id='165']").fill("2025550198");
  await page.locator("input[id='250']").fill("2025550198");
  await page.locator("input[id='164']").fill(profile.email);
  await page.locator("input[id='251']").fill("123 Market St");
  await page.locator("input[id='168']").fill("San Francisco");
  await page.locator("input[id='683']").fill("94105");

  // Checkbox
  await page.locator("input[id='209']").check({ force: true });
  await page.waitForTimeout(500);

  // Click continue
  const continueBtn = page.locator("button[name='next'], button:has-text('Continue')").first();
  await continueBtn.click();
  await page.waitForTimeout(4000);

  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".form__error, .error, .errorMessage, [role='alert']")).map(el => el.textContent?.trim()).filter(Boolean);
  });
  console.log("Errors after submit:", errors);

  const currentUrl = page.url();
  console.log("Current URL:", currentUrl);

  const heading = await page.locator("h1, h2, legend, .Section__legend").allTextContents();
  console.log("Page headings:", heading);

  await browser.close();
}

checkAfterSubmit().catch(console.error);

