import { chromium } from "playwright";
import fs from "fs";

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
  
  if (!page.url().includes("/preferences")) {
    await page.goto("https://wellfound.com/jobs/onboarding/preferences", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }
  
  // 1. Where are you in job search? -> Ready to interview
  console.log("Clicking 'Ready to interview'...");
  await page.locator("label[for='candidateState-interviewing']").click({ force: true });
  await page.waitForTimeout(300);

  // 2. Expected salary
  console.log("Filling expected salary: 95000...");
  const salaryInput = page.locator("input#expectedSalary");
  await salaryInput.fill("95000");
  await page.waitForTimeout(300);

  // 3. I'm open to working remotely
  console.log("Checking remote checkbox...");
  const remoteLabel = page.locator("label[for='distributedTeamOk']");
  await remoteLabel.click({ force: true });
  await page.waitForTimeout(300);

  // 4. US work authorization -> Yes
  console.log("Setting US work authorization -> Yes...");
  await page.locator("label[for='usAuthorized-1']").click({ force: true });
  await page.waitForTimeout(300);

  // 5. Require sponsorship -> No
  console.log("Setting Visa sponsorship -> No...");
  await page.locator("label[for='requireSponsorship-0']").click({ force: true });
  await page.waitForTimeout(300);

  // 6. Company sizes: click "Ideal" or "Yes" on company size buttons
  console.log("Setting company size preferences...");
  const idealButtons = page.locator("button:text-is('Ideal')");
  const idealCount = await idealButtons.count();
  for (let i = 0; i < idealCount; i++) {
    await idealButtons.nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(100);
  }

  await page.screenshot({ path: "scratch/onboarding_step2_filled.png" });

  // 7. Save and continue
  console.log("Clicking 'Save and continue'...");
  const saveBtn = page.locator("button:has-text('Save and continue')").first();
  await saveBtn.click();
  await page.waitForTimeout(5000);

  console.log("URL after Step 2 submit:", page.url());
  await page.screenshot({ path: "scratch/onboarding_step3_screen.png", fullPage: true });

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

  fs.writeFileSync("scratch/onboarding_step3_elements.json", JSON.stringify(elements, null, 2));
  console.log("Saved Step 3 elements to scratch/onboarding_step3_elements.json");

  await browser.close();
}

main().catch(console.error);

