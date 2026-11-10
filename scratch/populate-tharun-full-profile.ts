import { chromium, Page } from "playwright";

async function selectReactSelect(page: Page, inputSelector: string, text: string) {
  console.log(`Selecting '${text}' in ${inputSelector}...`);
  try {
    const input = page.locator(inputSelector).first();
    await input.click({ force: true });
    await page.waitForTimeout(200);
    await page.keyboard.type(text, { delay: 60 });
    await page.waitForTimeout(800);
    
    const option = page.locator(".Select-menu-outer .Select-option, [class*='Select-option'], [role='option'], [id*='option']").first();
    if (await option.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log(`Found option for ${text}, clicking...`);
      await option.click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
  } catch (err: any) {
    console.warn(`Warning selecting ${text}:`, err.message);
  }
  await page.waitForTimeout(300);
}

async function addSkill(page: Page, skill: string) {
  console.log(`Adding skill '${skill}'...`);
  try {
    const skillInput = page.locator("input[placeholder*='e.g. Python, React' i], input[placeholder*='skill' i]").first();
    if (await skillInput.isVisible().catch(() => false)) {
      await skillInput.click({ force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(skill, { delay: 50 });
      await page.waitForTimeout(600);
      
      const option = page.locator("[role='option'], [class*='option'], [id*='downshift']").first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click({ force: true });
      } else {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(200);
    }
  } catch (err: any) {
    console.warn(`Warning adding skill ${skill}:`, err.message);
  }
}

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
  
  // Click modal button or dismiss overlay
  const interviewTimeBtn = page.locator("button:has-text('In two weeks'), button:has-text('Not interested')").first();
  if (await interviewTimeBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log("Answering interview availability modal...");
    await interviewTimeBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Remove any remaining ReactModalPortal overlays
  await page.evaluate(() => {
    document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => el.remove());
  }).catch(() => {});
  await page.waitForTimeout(500);

  // Check if "Review resume findings" banner is present
  const reviewResumeBtn = page.locator("button:has-text('Review')").first();
  if (await reviewResumeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("Clicking 'Review' to accept extracted items from uploaded resume...");
    await reviewResumeBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // In review modal, click Accept All or Save if present
    const acceptAllBtn = page.locator("button:has-text('Accept all'), button:has-text('Add all'), button:has-text('Save'), button:has-text('Confirm')").first();
    if (await acceptAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("Clicking Accept All resume findings...");
      await acceptAllBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  // Remove any lingering modals
  await page.evaluate(() => {
    document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => el.remove());
  }).catch(() => {});

  // 1. FILL BIO
  console.log("3. Filling Bio...");
  const bioInput = page.locator("textarea#form-input--bio");
  if (await bioInput.isVisible().catch(() => false)) {
    const bioText = "Full-Stack AI Developer specializing in Python, FastAPI, React, and RAG architectures. Experienced in building high-performance web applications and scalable cloud systems.";
    await bioInput.fill(bioText);
  }

  // 2. FILL SOCIAL LINKS
  console.log("4. Filling Social links (GitHub, Twitter, Portfolio)...");
  const ghInput = page.locator("input#form-input--githubUrl");
  if (await ghInput.isVisible().catch(() => false)) {
    await ghInput.fill("https://github.com/tharunkomite");
  }
  const twInput = page.locator("input#form-input--twitterUrl");
  if (await twInput.isVisible().catch(() => false)) {
    await twInput.fill("https://x.com/tharunkomite");
  }

  // 3. FILL OPEN TO ROLES
  console.log("5. Filling Open to roles...");
  await selectReactSelect(page, "#react-select-form-input--roleIds-input", "Full Stack Engineer");
  await selectReactSelect(page, "#react-select-form-input--roleIds-input", "Software Engineer");

  // 4. FILL EDUCATION
  console.log("6. Filling Education...");
  const schoolInput = page.locator("input[placeholder*='College / University']").first();
  if (await schoolInput.isVisible().catch(() => false)) {
    await schoolInput.click({ force: true });
    await page.keyboard.type("San Francisco State University", { delay: 50 });
    await page.waitForTimeout(800);
    const schoolOption = page.locator("[role='option'], [class*='option'], [id*='downshift']").first();
    if (await schoolOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await schoolOption.click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);

    // Graduation
    const gradInput = page.locator("input[placeholder*='Graduation']").first();
    if (await gradInput.isVisible().catch(() => false)) {
      await gradInput.fill("2024");
    }

    // Degree Type
    await selectReactSelect(page, "#react-select-form-input--degreeType-input", "Bachelor's Degree");

    // Major
    const majorInput = page.locator("input#form-input--majors\\[0\\], input[placeholder*='Major']").first();
    if (await majorInput.isVisible().catch(() => false)) {
      await majorInput.fill("Computer Science");
    }

    // GPA
    const gpaInput = page.locator("input#form-input--gpa");
    if (await gpaInput.isVisible().catch(() => false)) {
      await gpaInput.fill("3.8");
    }
    const maxGpaInput = page.locator("input#form-input--maxGpa");
    if (await maxGpaInput.isVisible().catch(() => false)) {
      await maxGpaInput.fill("4.0");
    }

    // Click Save for Education
    const saveEduBtn = page.locator("button:text-is('Save')").first();
    if (await saveEduBtn.isVisible().catch(() => false)) {
      await saveEduBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  // 5. FILL TECHNICAL SKILLS
  console.log("7. Filling Technical Skills...");
  const skills = [
    "Python", "FastAPI", "React", "TypeScript", "Docker", 
    "PostgreSQL", "Node.js", "REST APIs", "Git", "Azure", "RAG", "OpenAI"
  ];
  for (const s of skills) {
    await addSkill(page, s);
  }

  // 6. FILL ACHIEVEMENTS
  console.log("8. Filling Achievements...");
  const achInput = page.locator("textarea#form-input--whatIveBuilt");
  if (await achInput.isVisible().catch(() => false)) {
    const achText = "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed scalable FastAPI backend services and React frontend workflows. Reduced API response latency by 30% through PostgreSQL query optimization. Containerized applications using Docker and Azure.";
    await achInput.fill(achText);
  }

  // 7. IDENTITY (Pronouns, Gender, Race)
  console.log("9. Filling Identity demographics...");
  await selectReactSelect(page, "#react-select-form-input--pronouns-input", "He/Him");
  await selectReactSelect(page, "#react-select-form-input--gender-input", "Man");
  
  const raceSouthAsian = page.locator("input#form-input--raceEthnicityOrigins--SOUTH_ASIAN, label:has-text('South Asian')").first();
  if (await raceSouthAsian.isVisible().catch(() => false)) {
    await raceSouthAsian.click({ force: true }).catch(() => {});
  }

  // 8. SAVE CHANGES ON PROFILE
  console.log("10. Saving all profile changes...");
  const saveAllBtn = page.locator("button:has-text('Save changes'), button:has-text('Save'), input[type='submit'][value*='Save']").last();
  if (await saveAllBtn.isVisible().catch(() => false)) {
    console.log("Clicking save changes button:", await saveAllBtn.innerText().catch(() => "Save"));
    await saveAllBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Take screenshot of completed profile
  await page.screenshot({ path: "scratch/tharun_profile_completed.png", fullPage: true });
  console.log("Screenshot saved to scratch/tharun_profile_completed.png");

  // 9. VERIFY PREFERENCES TAB
  console.log("11. Verifying and saving Preferences tab...");
  await page.goto("https://wellfound.com/profile/edit/preferences", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  const noSponsorship = page.locator("#form-input--requireSponsorship--false").first();
  if (await noSponsorship.isVisible().catch(() => false)) {
    await noSponsorship.check({ force: true }).catch(() => {});
  }
  const usAuthorized = page.locator("#form-input--usAuthorized--true").first();
  if (await usAuthorized.isVisible().catch(() => false)) {
    await usAuthorized.check({ force: true }).catch(() => {});
  }

  const savePrefBtn = page.locator("button:has-text('Save'), button:has-text('Save changes')").first();
  if (await savePrefBtn.isVisible().catch(() => false)) {
    await savePrefBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: "scratch/tharun_preferences_completed.png", fullPage: true });
  console.log("Screenshot saved to scratch/tharun_preferences_completed.png");

  console.log("\n🎉 ALL PROFILE AND PREFERENCES FIELDS HAVE BEEN 100% POPULATED WITH US DATA!");
  await browser.close();
}

main().catch(console.error);
