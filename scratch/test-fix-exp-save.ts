import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `hrutin_test_fix_${Date.now()}@gmail.com`;
  console.log("Navigating to Oracle email step...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  // Wait for Section 1
  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Fill Sec 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "4155552671").catch(() => {});

  // Go to Sec 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Upload resume in Sec 2
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Go to Sec 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(8000);

  // Click edit specifically inside the EXPERIENCE block!
  console.log("Opening Experience tile...");
  await page.evaluate(() => {
    const allBlocks = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block"));
    const expBlock = allBlocks.find(b => b.textContent?.toLowerCase().includes("experience"));
    const invalidTile = expBlock?.querySelector(".apply-flow-profile-item-tile--invalid");
    const editBtn = invalidTile?.querySelector(".apply-flow-profile-item-tile__edit-item-icon") as HTMLElement;
    if (editBtn) editBtn.click();
  });
  await page.waitForTimeout(2000);

  // Method A: Change Start Month to August or Start Year to 2024 using Playwright input interaction
  console.log("Adjusting Start Date via dropdown/combobox typing...");
  
  // Find start year input
  const startYearLocator = page.locator("input[id*='year-startDate']").first();
  if (await startYearLocator.count() > 0) {
    await startYearLocator.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await startYearLocator.fill("2024");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }

  // Find start month input
  const startMonthLocator = page.locator("input[id*='month-startDate']").first();
  if (await startMonthLocator.count() > 0) {
    await startMonthLocator.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await startMonthLocator.fill("January");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }

  // Click Save button inside the form
  console.log("Clicking Save button...");
  await page.evaluate(() => {
    const expBlock = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block")).find(b => b.textContent?.toLowerCase().includes("experience"));
    const saveBtn = Array.from(expBlock?.querySelectorAll("button") || []).find(b => b.textContent?.trim().toLowerCase() === "save") as HTMLElement;
    if (saveBtn) saveBtn.click();
  });
  await page.waitForTimeout(3000);

  // Check state of the tile after save
  const afterSaveTiles = await page.evaluate(() => {
    const expBlock = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block")).find(b => b.textContent?.toLowerCase().includes("experience"));
    const tiles = Array.from(expBlock?.querySelectorAll(".apply-flow-profile-item-tile") || []).map(t => ({
      title: t.querySelector(".apply-flow-profile-item-tile__summary-title")?.textContent?.trim(),
      subtitle: t.querySelector(".apply-flow-profile-item-tile__summary-subtitle")?.textContent?.trim(),
      validation: t.querySelector(".apply-flow-profile-item-tile__summary-validation")?.textContent?.trim() || "NONE",
      isInvalid: t.classList.contains("apply-flow-profile-item-tile--invalid")
    }));
    return tiles;
  });

  console.log("=== TILES AFTER SAVE ===");
  console.log(JSON.stringify(afterSaveTiles, null, 2));

  await browser.close();
}

main().catch(console.error);
