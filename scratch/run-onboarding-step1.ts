import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  await page.locator("input#user_email, input[type='email']").first().fill("tharunkomite7@gmail.com");
  await page.locator("input#user_password, input[type='password']").first().fill("TharunDev@2024!");
  await page.locator("input[type='submit'][value*='Log in' i], button[type='submit']").first().click();
  await page.waitForTimeout(4000);
  
  console.log("Current URL after login:", page.url());
  
  // 1. Where are you based? (currentLocation)
  console.log("Filling Location...");
  const locInput = page.locator("input#currentLocation");
  await locInput.click();
  await locInput.fill("San Francisco, CA");
  await page.waitForTimeout(1000);
  const locOption = page.locator("[role='option'], [class*='option']").first();
  if (await locOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("Clicking location option:", await locOption.innerText());
    await locOption.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(500);

  // 2. What best describes your current role? (roles)
  console.log("Filling Role...");
  const roleInput = page.locator("input#roles");
  await roleInput.click();
  await roleInput.fill("Software Engineer");
  await page.waitForTimeout(1000);
  const roleOption = page.locator("[role='option'], [class*='option']").first();
  if (await roleOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("Clicking role option:", await roleOption.innerText());
    await roleOption.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(500);

  // 3. How many years of experience? (yearsExperience)
  console.log("Filling Years of Experience...");
  const expInput = page.locator("input#yearsExperience");
  await expInput.click();
  await expInput.fill("2");
  await page.waitForTimeout(1000);
  const expOption = page.locator("[role='option'], [class*='option']").first();
  if (await expOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("Clicking exp option:", await expOption.innerText());
    await expOption.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(500);

  // 4. Student or new grad? (No)
  const studentNo = page.locator("input#student-0, label:has-text('No')").first();
  if (await studentNo.isVisible().catch(() => false)) {
    await studentNo.check({ force: true }).catch(() => studentNo.click());
  }

  // 5. Job title & Company
  console.log("Filling Job Title & Company...");
  await page.locator("input#jobTitle").fill("Full Stack AI Developer");
  await page.waitForTimeout(300);
  
  const compInput = page.locator("input#company");
  await compInput.click();
  await compInput.fill("Jobspring");
  await page.waitForTimeout(1000);
  const compOption = page.locator("[role='option'], [class*='option']").first();
  if (await compOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await compOption.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(300);

  // 6. LinkedIn & Website
  console.log("Filling Social Links...");
  await page.locator("input#linkedinUrl").fill("https://linkedin.com/in/tharunkomite");
  await page.locator("input#onlineBioUrl").fill("https://tharunkomite.dev");
  await page.waitForTimeout(500);

  await page.screenshot({ path: "scratch/onboarding_step1_filled.png" });

  // 7. Click Create your profile
  console.log("Submitting Step 1...");
  const submitBtn = page.locator("button:has-text('Create your profile')").first();
  await submitBtn.click();
  await page.waitForTimeout(5000);

  console.log("URL after Step 1 submit:", page.url());
  await page.screenshot({ path: "scratch/onboarding_step2_screen.png", fullPage: true });

  const formElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button, [role='combobox'], [role='listbox']")).map(el => {
      return {
        tag: el.tagName,
        id: el.id,
        name: el.getAttribute("name"),
        type: el.getAttribute("type"),
        placeholder: el.getAttribute("placeholder"),
        text: el.textContent?.trim().slice(0, 50),
        role: el.getAttribute("role"),
        class: el.className
      };
    });
  });
  
  fs.writeFileSync("scratch/onboarding_step2_elements.json", JSON.stringify(formElements, null, 2));
  console.log("Saved Step 2 elements to scratch/onboarding_step2_elements.json");

  await browser.close();
}

main().catch(console.error);

