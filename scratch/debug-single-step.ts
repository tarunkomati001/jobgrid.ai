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

async function testSingleStep() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to Job 1...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4616387", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Fill text inputs
  const inputs = await page.evaluate(() => {
    const list: any[] = [];
    document.querySelectorAll("input, select, textarea").forEach((el: any) => {
      list.push({
        id: el.id,
        name: el.name,
        type: el.type,
        required: el.required,
        value: el.value,
        validity: el.validity ? { valid: el.validity.valid, valueMissing: el.validity.valueMissing } : null
      });
    });
    return list;
  });
  console.log("Initial fields count:", inputs.length);

  // Use adapter to fill text, state, comboboxes etc.
  const adapter = new PaylocityAdapter();
  // Fill once
  await (adapter as any).dismissCookies(page);
  await (adapter as any).fillAllTextInputs(page, (k: string) => "Test", mockProfile);
  await (adapter as any).handleStateDropdown(page, mockProfile);
  await (adapter as any).fillAllComboboxes(page, (k: string, opts?: string[]) => opts ? opts[1] || "Yes" : "Yes", mockProfile);

  // Check validity of all fields now
  const validityAfter = await page.evaluate(() => {
    const res: any[] = [];
    document.querySelectorAll("input, select, textarea").forEach((el: any) => {
      if (!el.validity?.valid || el.required) {
        res.push({
          id: el.id,
          name: el.name,
          type: el.type,
          required: el.required,
          value: el.value,
          valid: el.validity?.valid,
          validationMessage: el.validationMessage
        });
      }
    });
    return res;
  });
  console.log("Required / Invalid fields after filling:", JSON.stringify(validityAfter, null, 2));

  // Check Address 1 value
  const addr1Val = await page.locator("#public-site-address-address-1").inputValue().catch(() => "NOT_FOUND");
  console.log("Address 1 input value:", addr1Val);

  // Check Resume file input
  const resumeAttached = await page.locator("button:has-text('Remove'), a:has-text('Remove')").count();
  console.log("Resume attached count:", resumeAttached);

  // Check next button
  const submitBtn = page.locator("button#btn-submit, button[type='submit']:has-text('Next Step'), button:has-text('Next Step')").first();
  console.log("Submit button text:", await submitBtn.innerText());
  console.log("Submit button disabled:", await submitBtn.getAttribute("disabled"));

  await submitBtn.click();
  await page.waitForTimeout(3000);

  const stepText = await page.locator("p:has-text('Step'), [class*='step']").allInnerTexts();
  console.log("Step text after click:", stepText);

  await page.screenshot({ path: "scratch/debug_click_result.png", fullPage: true });

  await browser.close();
}

testSingleStep().catch(console.error);
