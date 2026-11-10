import { chromium } from "playwright";
import fs from "fs";

async function selectSkill(page: any, containerIndex: number, skillName: string) {
  console.log(`Adding tech interest '${skillName}'...`);
  const input = page.locator(".Select-input input").nth(containerIndex);
  await input.click({ force: true });
  await page.waitForTimeout(200);
  await page.keyboard.type(skillName, { delay: 60 });
  await page.waitForTimeout(600);
  
  const option = page.locator(".Select-menu-outer .Select-option, [class*='Select-option']").first();
  if (await option.isVisible({ timeout: 2500 }).catch(() => false)) {
    await option.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  await page.locator("input#user_email, input[type='email']").first().fill("tharunkomite7@gmail.com");
  await page.locator("input#user_password, input[type='password']").first().fill("TharunDev@2024!");
  await page.locator("input[type='submit'][value*='Log in' i], button[type='submit']").first().click();
  await page.waitForTimeout(4000);
  
  console.log("Current URL:", page.url());
  if (!page.url().includes("/culture")) {
    await page.goto("https://wellfound.com/jobs/onboarding/culture", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  // 1. Technologies most interested in
  const skillsToAdd = ["Python", "React", "TypeScript", "FastAPI", "Docker"];
  for (const skill of skillsToAdd) {
    await selectSkill(page, 0, skill);
  }

  // 2. What motivates you more? -> Building products
  console.log("Selecting motivation...");
  await page.locator("label:has-text('Building products')").first().click({ force: true });
  await page.waitForTimeout(200);

  // 3. Career track -> Individual contributor
  console.log("Selecting career track...");
  await page.locator("label:has-text('Individual contributor')").first().click({ force: true });
  await page.waitForTimeout(200);

  // 4. What environment -> wear a lot of hats
  console.log("Selecting work environment...");
  await page.locator("label:has-text('wear a lot of hats')").first().click({ force: true });
  await page.waitForTimeout(200);

  // 5. What's most important to you (Max 2)
  console.log("Selecting what's most important...");
  await page.locator("label:has-text('Team members I can learn from')").first().click({ force: true });
  await page.waitForTimeout(200);
  await page.locator("label:has-text('Learn new things and develop my skills')").first().click({ force: true });
  await page.waitForTimeout(200);

  // 6. Flexible remote work policy -> Very important
  console.log("Selecting remote policy preference...");
  const remoteOptions = page.locator("label:has-text('Very important')");
  if (await remoteOptions.count() > 0) {
    await remoteOptions.first().click({ force: true });
    await page.waitForTimeout(200);
  }

  // 7. Quiet office -> Important
  console.log("Selecting office preference...");
  const officeOptions = page.locator("label:has-text('Important')");
  if (await officeOptions.count() > 1) {
    await officeOptions.nth(1).click({ force: true });
    await page.waitForTimeout(200);
  }

  // 8. Describe what you are looking for in your next job (criteria)
  console.log("Filling criteria textarea...");
  const criteriaText = "I am looking for a Full Stack or AI Engineer role at a fast-growing US startup where I can build scalable web services, integrate generative AI and LLM workflows, optimize backend systems, and collaborate closely with cross-functional product and engineering teams.";
  await page.locator("textarea#criteria").fill(criteriaText);
  await page.waitForTimeout(300);

  await page.screenshot({ path: "scratch/onboarding_step3_filled.png" });

  // 9. Save and continue
  console.log("Clicking 'Save and continue' on Step 3...");
  const saveBtn = page.locator("button:has-text('Save and continue')").first();
  await saveBtn.click();
  await page.waitForTimeout(5000);

  console.log("URL after Step 3 submit:", page.url());
  await page.screenshot({ path: "scratch/onboarding_step4_screen.png", fullPage: true });

  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button, label")).map(el => {
      return {
        tag: el.tagName,
        id: el.id,
        name: el.getAttribute("name"),
        type: el.getAttribute("type"),
        value: (el as any).value,
        text: el.textContent?.trim().slice(0, 60),
        for: el.getAttribute("for")
      };
    });
  });

  fs.writeFileSync("scratch/onboarding_step4_elements.json", JSON.stringify(elements, null, 2));
  console.log("Saved Step 4 elements to scratch/onboarding_step4_elements.json");

  await browser.close();
}

main().catch(console.error);

