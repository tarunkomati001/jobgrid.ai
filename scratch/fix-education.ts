import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  await page.locator("input#user_email, input[type='email']").first().fill("tharunkomite7@gmail.com");
  await page.locator("input#user_password, input[type='password']").first().fill("TharunDev@2024!");
  await page.locator("input[type='submit'][value*='Log in' i], button[type='submit']").first().click();
  await page.waitForTimeout(4000);
  
  await page.goto("https://wellfound.com/profile/edit", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  // Remove overlays
  await page.evaluate(() => {
    document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => el.remove());
  });
  await page.waitForTimeout(500);

  // Focus education input
  console.log("Fixing Education college autocomplete...");
  const eduInput = page.locator("input[placeholder*='College / University']").first();
  await eduInput.click({ force: true });
  await eduInput.fill("");
  await page.waitForTimeout(300);
  await page.keyboard.type("San Francisco State University", { delay: 80 });
  await page.waitForTimeout(1500);

  // Look for the autocomplete menu
  const menuOptions = page.locator("[role='option'], [class*='option'], [id*='downshift-']");
  const optCount = await menuOptions.count();
  console.log(`Found ${optCount} autocomplete options for college`);
  
  if (optCount > 0) {
    const firstOpt = menuOptions.first();
    console.log("Clicking option:", await firstOpt.innerText().catch(() => "option"));
    await firstOpt.click({ force: true });
  } else {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(500);

  // Click Save for Education
  const saveBtn = page.locator("button:text-is('Save')").first();
  await saveBtn.click({ force: true });
  await page.waitForTimeout(3000);

  // Save all changes at the bottom as well
  const saveAllBtn = page.locator("button:has-text('Save changes'), button:has-text('Save')").last();
  if (await saveAllBtn.isVisible().catch(() => false)) {
    await saveAllBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: "scratch/tharun_profile_final_verified.png", fullPage: true });
  console.log("Saved scratch/tharun_profile_final_verified.png");

  await browser.close();
}

main().catch(console.error);

