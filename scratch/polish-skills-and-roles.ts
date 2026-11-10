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

  // Clear overlays
  await page.evaluate(() => {
    document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => el.remove());
  });

  // 1. Add skills by clicking the item-0 dropdown element
  const skills = [
    "Python", "React", "TypeScript", "FastAPI", "Docker", 
    "PostgreSQL", "Node.js", "Git", "REST APIs", "OpenAI"
  ];

  const skillInput = page.locator("input[placeholder*='e.g. Python, React']").first();
  if (await skillInput.isVisible().catch(() => false)) {
    for (const skill of skills) {
      console.log(`Adding skill: ${skill}...`);
      await skillInput.click({ force: true });
      await skillInput.fill(skill);
      await page.waitForTimeout(600);
      
      const option = page.locator("[id*='downshift-'][id*='-item-0'], [role='option']").first();
      if (await option.isVisible({ timeout: 1500 }).catch(() => false)) {
        await option.click({ force: true });
      } else {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(100);
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(400);
    }
  }

  // 2. Open to roles
  console.log("Setting Open to the following roles...");
  const roleInput = page.locator("#react-select-form-input--roleIds-input").first();
  if (await roleInput.isVisible().catch(() => false)) {
    await roleInput.click({ force: true });
    await page.keyboard.type("Full Stack Engineer", { delay: 50 });
    await page.waitForTimeout(700);
    const opt1 = page.locator(".Select-menu-outer .Select-option, [class*='Select-option']").first();
    if (await opt1.isVisible({ timeout: 2000 }).catch(() => false)) {
      await opt1.click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);
  }

  // 3. Pronouns & Race
  console.log("Setting Pronouns & Race...");
  const pronounInput = page.locator("#react-select-form-input--pronouns-input").first();
  if (await pronounInput.isVisible().catch(() => false)) {
    await pronounInput.click({ force: true });
    await page.keyboard.type("He/Him", { delay: 50 });
    await page.waitForTimeout(600);
    const pOpt = page.locator(".Select-menu-outer .Select-option, [class*='Select-option']").first();
    if (await pOpt.isVisible({ timeout: 1500 }).catch(() => false)) {
      await pOpt.click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);
  }

  const raceSouthAsian = page.locator("input#form-input--raceEthnicityOrigins--SOUTH_ASIAN, label:has-text('South Asian')").first();
  if (await raceSouthAsian.isVisible().catch(() => false)) {
    await raceSouthAsian.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // Save changes
  const saveBtn = page.locator("button:has-text('Save changes'), button[type='submit']:has-text('Save')").last();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Click outside to close any open dropdown
  await page.locator("h1:has-text('Edit your Wellfound profile')").click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);

  // Take final verified screenshot
  await page.screenshot({ path: "scratch/tharun_profile_final_100_percent.png", fullPage: true });
  console.log("📸 Saved scratch/tharun_profile_final_100_percent.png");

  await browser.close();
}

main().catch(console.error);

