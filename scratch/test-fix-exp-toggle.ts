import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `hrutin_fix_exp_test_${Date.now()}@gmail.com`;
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

  console.log("On Section 3! Checking invalid experience tile...");
  
  // 1. Scroll to and click Edit on the invalid experience tile
  const opened = await page.evaluate(() => {
    const expBlock = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block")).find(b => b.textContent?.toLowerCase().includes("experience"));
    if (!expBlock) return false;

    const invalidTile = expBlock.querySelector(".apply-flow-profile-item-tile--invalid");
    if (!invalidTile) return false;

    invalidTile.scrollIntoView({ behavior: "instant", block: "center" });
    const editBtn = invalidTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit']") as HTMLElement;
    if (editBtn) {
      editBtn.click();
      return true;
    }
    return false;
  });

  console.log("Opened invalid experience tile:", opened);
  await page.waitForTimeout(2000);

  // 2. In the opened form, let's change Start Year or Start Month via toggle/dropdown or reset
  // Let's see: We have toggle button for year-startDate: button[id*='year-startDate'][id*='toggle']
  console.log("Clicking year-startDate toggle button...");
  await page.evaluate(() => {
    const yToggle = document.querySelector("button[id*='year-startDate'][id*='toggle']") as HTMLElement;
    if (yToggle) {
      yToggle.scrollIntoView({ behavior: "instant", block: "center" });
      yToggle.click();
    }
  });
  await page.waitForTimeout(500);

  // Select an earlier year (e.g. 2024) from the listbox
  const selectedYear = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll("[id*='year-startDate'] [role='option'], .cx-select__list-item, [role='option']"));
    const match = options.find(o => o.textContent?.trim() === "2024");
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  });
  console.log("Selected Start Year:", selectedYear);
  await page.waitForTimeout(800);

  // If Start Year wasn't selected via dropdown, try clicking month-startDate toggle and selecting January
  console.log("Clicking month-startDate toggle button...");
  await page.evaluate(() => {
    const mToggle = document.querySelector("button[id*='month-startDate'][id*='toggle']") as HTMLElement;
    if (mToggle) {
      mToggle.scrollIntoView({ behavior: "instant", block: "center" });
      mToggle.click();
    }
  });
  await page.waitForTimeout(500);

  const selectedMonth = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll("[id*='month-startDate'] [role='option'], .cx-select__list-item, [role='option']"));
    const match = options.find(o => o.textContent?.trim().toLowerCase().includes("jan"));
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  });
  console.log("Selected Start Month:", selectedMonth);
  await page.waitForTimeout(800);

  // Now click Save button inside the active experience form
  console.log("Clicking Save button in experience form...");
  await page.evaluate(() => {
    const expBlock = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block")).find(b => b.textContent?.toLowerCase().includes("experience"));
    const btns = Array.from(expBlock?.querySelectorAll("button") || []);
    const saveBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "save") as HTMLElement;
    if (saveBtn) {
      saveBtn.scrollIntoView({ behavior: "instant", block: "center" });
      saveBtn.click();
    }
  });
  await page.waitForTimeout(3000);

  // Check state of the experience tiles!
  const finalExpTiles = await page.evaluate(() => {
    const expBlock = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block")).find(b => b.textContent?.toLowerCase().includes("experience"));
    const tiles = Array.from(expBlock?.querySelectorAll(".apply-flow-profile-item-tile") || []).map(t => ({
      title: t.querySelector(".apply-flow-profile-item-tile__summary-title")?.textContent?.trim(),
      subtitle: t.querySelector(".apply-flow-profile-item-tile__summary-subtitle")?.textContent?.trim(),
      validation: t.querySelector(".apply-flow-profile-item-tile__summary-validation")?.textContent?.trim() || "VALID",
      isInvalid: t.classList.contains("apply-flow-profile-item-tile--invalid")
    }));
    return tiles;
  });

  console.log("=== FINAL EXPERIENCE TILES ===");
  console.log(JSON.stringify(finalExpTiles, null, 2));

  await browser.close();
}

main().catch(console.error);
