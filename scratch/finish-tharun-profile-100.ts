import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("1. Logging into Wellfound as Tharun Komite...");
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  await page.locator("input#user_email, input[type='email']").first().fill("tharunkomite7@gmail.com");
  await page.locator("input#user_password, input[type='password']").first().fill("TharunDev@2024!");
  await page.locator("input[type='submit'][value*='Log in' i], button[type='submit']").first().click();
  await page.waitForTimeout(4000);
  
  console.log("2. Navigating to https://wellfound.com/profile/edit...");
  await page.goto("https://wellfound.com/profile/edit", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // A. Handle "Feature my profile" modal if present
  console.log("Checking for feature modal...");
  const featureBtn = page.locator("button:has-text('Feature my profile')").first();
  if (await featureBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("Completing feature modal...");
    const checkboxes = page.locator(".ReactModalPortal input[type='checkbox']");
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      await checkboxes.nth(i).check({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(300);
    await featureBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Remove any modal overlays
  await page.evaluate(() => {
    document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => el.remove());
  });
  await page.waitForTimeout(500);

  // B. Fill Social Profiles (GitHub & Twitter)
  console.log("Filling Social Profiles...");
  const ghInput = page.locator("input#form-input--githubUrl");
  await ghInput.click({ force: true });
  await ghInput.fill("https://github.com/tharunkomite");
  await page.waitForTimeout(300);

  const twInput = page.locator("input#form-input--twitterUrl");
  await twInput.click({ force: true });
  await twInput.fill("https://x.com/tharunkomite");
  await page.waitForTimeout(500);

  // Click Save for Social Profiles
  const saveSocialBtn = page.locator("button[type='submit']:has-text('Save')").first();
  if (await saveSocialBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("Saving Social Profiles...");
    await saveSocialBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // C. Add Skills
  console.log("Adding Skills...");
  const skills = [
    "Python", "FastAPI", "React", "TypeScript", "Docker",
    "PostgreSQL", "Node.js", "REST APIs", "Git", "Azure", "RAG", "OpenAI"
  ];

  const skillInput = page.locator("input[placeholder*='e.g. Python, React']").first();
  if (await skillInput.isVisible().catch(() => false)) {
    for (const skill of skills) {
      console.log(`Adding skill: ${skill}...`);
      await skillInput.click({ force: true });
      await skillInput.fill(skill);
      await page.waitForTimeout(800);
      
      const option = page.locator("[role='option'], [class*='option'], [id*='downshift-']").first();
      if (await option.isVisible({ timeout: 1500 }).catch(() => false)) {
        await option.click({ force: true });
      } else {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(300);
    }
  }

  // D. Identity Demographics
  console.log("Setting Identity demographics (South Asian)...");
  const raceSouthAsian = page.locator("input#form-input--raceEthnicityOrigins--SOUTH_ASIAN, label:has-text('South Asian')").first();
  if (await raceSouthAsian.isVisible().catch(() => false)) {
    await raceSouthAsian.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // E. Final check: if any Save button is visible, click it
  const remainingSave = page.locator("button:has-text('Save changes'), button[type='submit']:has-text('Save')");
  const saveCount = await remainingSave.count();
  for (let i = 0; i < saveCount; i++) {
    await remainingSave.nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  console.log("Waiting for all updates to persist...");
  await page.waitForTimeout(3000);

  // Take final verified screenshot
  await page.screenshot({ path: "scratch/tharun_profile_100_percent.png", fullPage: true });
  console.log("📸 Saved scratch/tharun_profile_100_percent.png");

  await browser.close();
}

main().catch(console.error);

