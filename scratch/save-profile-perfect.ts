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

  // Clear modal overlays
  await page.evaluate(() => {
    document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => el.remove());
  });

  // 1. Bio (under 160 chars)
  console.log("Updating Bio...");
  const bio = "Full-Stack AI Developer specializing in Python, FastAPI, React & RAG. Experienced in building scalable web apps & cloud infrastructure.";
  await page.locator("textarea#form-input--bio").fill(bio);
  await page.waitForTimeout(500);

  // 2. Social Profiles
  console.log("Updating Social Profiles...");
  const gh = page.locator("input#form-input--githubUrl");
  await gh.click();
  await gh.fill("https://github.com/tharunkomite");
  await page.waitForTimeout(300);

  const tw = page.locator("input#form-input--twitterUrl");
  await tw.click();
  await tw.fill("https://x.com/tharunkomite");
  await page.waitForTimeout(500);

  // Find the Save button within Social Profiles
  const socialSection = page.locator("section:has-text('Social Profiles'), div:has(input#form-input--githubUrl)");
  const socialSaveBtn = socialSection.locator("button:has-text('Save'), button[type='submit']").first();
  if (await socialSaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("Clicking Save in Social Profiles...");
    await socialSaveBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // 3. Education
  console.log("Resetting and filling Education...");
  // First click cancel if in error state
  const cancelBtn = page.locator("button:text-is('Cancel')").first();
  if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cancelBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // If there is an "+ Add education" button
  const addEduBtn = page.locator("button:has-text('Add education'), button:has-text('Education')").first();
  if (await addEduBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await addEduBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const collegeInput = page.locator("input[placeholder*='College / University']").first();
  if (await collegeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await collegeInput.click();
    await page.keyboard.type("Stanford", { delay: 100 });
    await page.waitForTimeout(1500);

    // Pick first item in downshift menu
    const downshiftItem = page.locator("[id*='downshift-'][id*='item']").first();
    if (await downshiftItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Selected college:", await downshiftItem.innerText());
      await downshiftItem.click({ force: true });
    } else {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(500);

    // Graduation
    const gradInput = page.locator("input[placeholder*='Graduation']").first();
    await gradInput.fill("2024");
    await page.waitForTimeout(300);

    // Degree Type
    const degreeInput = page.locator("#react-select-form-input--degreeType-input").first();
    await degreeInput.click({ force: true });
    await page.keyboard.type("Bachelor's Degree", { delay: 60 });
    await page.waitForTimeout(800);
    const degOpt = page.locator(".Select-menu-outer .Select-option, [class*='Select-option']").first();
    if (await degOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await degOpt.click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);

    // Major
    const majorInput = page.locator("input[placeholder*='Major / Field of Study'], input#form-input--majors\\[0\\]").first();
    await majorInput.fill("Computer Science");
    await page.waitForTimeout(300);

    // GPA
    const gpaInput = page.locator("input#form-input--gpa");
    await gpaInput.fill("3.8");
    const maxGpaInput = page.locator("input#form-input--maxGpa");
    await maxGpaInput.fill("4.0");
    await page.waitForTimeout(300);

    // Click Save for Education
    const eduSave = page.locator("button:text-is('Save')").first();
    console.log("Saving Education...");
    await eduSave.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // 4. Save any remaining sections
  const saveButtons = page.locator("button:has-text('Save'), button[type='submit']:has-text('Save')");
  const count = await saveButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = saveButtons.nth(i);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: "scratch/tharun_profile_perfect.png", fullPage: true });
  console.log("Saved scratch/tharun_profile_perfect.png");

  await browser.close();
}

main().catch(console.error);

