import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { UserProfile } from "../src/ats/ats.interface";

const mockProfile: UserProfile = {
  userId: "e102be81-5e58-4508-bdf1-6cbdd9ff2757",
  firstName: "Hrutin",
  lastName: "Nammi",
  email: "hrutin.nammi@gmail.com",
  phone: "2025550198",
  street: "123 Market St",
  addressLine2: "Suite 400",
  city: "San Francisco",
  state: "CA",
  zipCode: "94105",
  country: "United States",
  linkedinUrl: "https://linkedin.com/in/hrutinnammi",
  githubUrl: "https://github.com/hrutinnammi",
  portfolioUrl: "https://hrutinnammi.dev",
  resumePath: "C:\\Users\\tarun\\Downloads\\cluco.ai\\cluco.ai\\src\\data\\resumes\\sample-resume.pdf",
  gender: "Male"
};

async function testStep1() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to Job 1...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4616387", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("input#info\\.firstName, input[name*='firstName'], .form-group", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Fill Step 1 with PaylocityAdapter logic
  const adapter = new PaylocityAdapter();
  // Call fillForm
  await adapter.fillForm(page, mockProfile);

  // Check what is on page now
  const stepText = await page.locator("p:has-text('Step'), [class*='step']").allInnerTexts();
  console.log("Step text after fillForm:", stepText);

  // Check for any validation error elements
  const allErrors = await page.evaluate(() => {
    const errorElements = Array.from(document.querySelectorAll("[class*='error'], [class*='invalid'], [aria-invalid='true'], span.text-danger, .field-validation-error"));
    return errorElements.map((el: any) => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: el.innerText || el.textContent
    })).filter(e => e.text && e.text.trim().length > 0);
  });
  console.log("Validation elements on page:", allErrors);

  await page.screenshot({ path: "scratch/step1_debug.png", fullPage: true });
  console.log("Saved screenshot to scratch/step1_debug.png");

  await browser.close();
}

testStep1().catch(console.error);
