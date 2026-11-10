import { chromium } from "playwright";
import path from "path";

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
  if (!page.url().includes("/resume")) {
    await page.goto("https://wellfound.com/jobs/onboarding/resume", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  const resumeFilePath = path.resolve(process.cwd(), "resumes/user_usr_tharun_komite/Tharun_Komite_Resume.pdf");
  console.log("Uploading resume from:", resumeFilePath);

  const fileInput = page.locator("input#resume, input[type='file']").first();
  await fileInput.setInputFiles(resumeFilePath);
  console.log("Resume set into input!");

  // Wait for processing or upload progress
  await page.waitForTimeout(8000);
  console.log("URL after upload:", page.url());
  await page.screenshot({ path: "scratch/onboarding_step4_uploaded.png", fullPage: true });

  // Check if there is a next/continue/finish button
  const continueBtn = page.locator("button:has-text('Continue'), button:has-text('Next'), button:has-text('Done'), button:has-text('Save'), a:has-text('Continue')").first();
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Clicking continue button:", await continueBtn.innerText());
    await continueBtn.click();
    await page.waitForTimeout(5000);
  }

  console.log("Final URL:", page.url());
  await page.screenshot({ path: "scratch/onboarding_step5_done.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);

