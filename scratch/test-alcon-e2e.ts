import { chromium } from 'playwright';
import { WorkdayAdapter } from '../src/ats/workday/workday.adapter';
import { UserProfile } from '../src/ats/ats.interface';
import { applyStealthScripts } from '../src/browser/browser-manager';
import path from 'path';

async function main() {
  console.log("🚀 Starting E2E test for Alcon Workday flow...");
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail+alcon2026@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    address: "B-402, Shree Krishna Heights",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390001",
    country: "India",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const adapter = new WorkdayAdapter();
  console.log("Calling adapter.fillForm()...");
  await adapter.fillForm(page, profile, {}, []);

  console.log("\nChecking wizard status after fillForm...");
  const currentUrl = page.url();
  console.log("Final page URL:", currentUrl);

  const hasSubmit = await page.locator("button[data-automation-id='bottom-navigation-next-button']:has-text('Submit'), button[data-automation-id='submitButton']").count() > 0;
  const reviewOrSubmit = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    return {
      hasReview: text.includes("Review") || text.includes("Submit"),
      activeStep: document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "none"
    };
  });

  console.log("Status details:", { ...reviewOrSubmit, hasSubmit });
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
