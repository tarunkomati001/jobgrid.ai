import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  console.log("Navigating directly to application flow...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", `test_gender_exact_${Date.now()}@gmail.com`);
  await page.click("label[for='legal-disclaimer-checkbox']");
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(6000);

  // We are on Section 1. Fill Section 1 quickly to get to Section 3
  console.log("Filling Section 1...");
  await page.fill("input[name='firstName']", "Hrutin");
  await page.fill("input[name='lastName']", "Nammi");
  await page.fill("input.phone-row__input", "4155552671");
  await page.fill("input[name='addressLine1']", "500 Oracle Parkway");
  await page.fill("input[name='postalCode']", "94065");
  await page.waitForTimeout(1000);

  // Click Next to go to Section 2
  const nextBtn1 = page.locator("button:has-text('Next')").last();
  await nextBtn1.click({ force: true });
  await page.waitForTimeout(5000);

  // Section 2: Click Next to go to Section 3
  console.log("On Section 2, clicking Next...");
  const nextBtn2 = page.locator("button:has-text('Next')").last();
  await nextBtn2.click({ force: true });
  await page.waitForTimeout(5000);

  console.log("On Section 3! URL:", page.url());

  // Test Gender selection
  const genderInput = page.locator("input[name*='GENDER'], input[id*='GENDER']").first();
  const toggleBtn = page.locator("button[id*='GENDER'][id*='toggle']").first();

  console.log("Gender input visible?", await genderInput.isVisible());
  console.log("Toggle button visible?", await toggleBtn.isVisible());

  // Click toggle button to open listbox
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    console.log("Clicked toggle button!");
    await page.waitForTimeout(1000);
  } else {
    await genderInput.click();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(1000);
  }

  // Inspect what options are in DOM
  const opts = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li"));
    return items.map(i => ({
      text: i.textContent?.trim(),
      tag: i.tagName,
      className: i.className,
      id: i.id,
      rect: i.getBoundingClientRect()
    }));
  });
  console.log("Open dropdown options:", opts);

  // Click Male strictly
  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li"));
    const match = items.find(i => i.textContent?.trim() === "Male");
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  });
  console.log("Clicked option:", clicked);
  await page.waitForTimeout(1000);

  const valAfter = await genderInput.inputValue();
  console.log("Gender input value after click:", valAfter);

  await page.screenshot({ path: "scratch/gender_exact_result.png" });
  console.log("Saved scratch/gender_exact_result.png");

  await browser.close();
}

main().catch(console.error);
