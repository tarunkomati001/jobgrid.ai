import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import { GreenhouseAdapter } from "../src/ats/greenhouse/greenhouse.adapter";
import { UserProfile } from "../src/ats/ats.interface";

async function testSubmitButton() {
  console.log("🚀 Testing Greenhouse submit button behavior...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);

  const adapter = new GreenhouseAdapter();
  const fields = await adapter.extractFields(page);

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Kumar",
    email: "babufakemail@gmail.com",
    phone: "+91 86884 23267",
    location: "Vadodara, Gujarat, India",
    linkedinUrl: "https://linkedin.com/in/hrutinkumar",
    githubUrl: "https://github.com/hrutinkumar",
  };

  console.log("✍️ Filling form fields...");
  await adapter.fillForm(page, profile, {}, fields);

  // Upload resume if file input is present
  const fs = await import("fs");
  const path = await import("path");
  const resumePath = path.join(__dirname, "..", "resumes", "user_usr_hrutin_nammi", "Hrutin_Nammi_Resume.pdf");
  if (fs.existsSync(resumePath)) {
    console.log("📄 Attaching resume...");
    await adapter.uploadResume(page, resumePath, fields);
  }

  // Inspect the submit button
  console.log("\n🔍 Inspecting Submit Button...");
  const submitLocators = [
    "#submit_app",
    "input[type='submit']",
    "button[type='submit']",
    "button:has-text('Submit application')",
    "button:has-text('Submit Application')",
    "button:has-text('Submit')",
    "input[value*='Submit']"
  ];

  for (const sel of submitLocators) {
    const loc = page.locator(sel);
    const count = await loc.count();
    if (count > 0) {
      const isVis = await loc.first().isVisible().catch(() => false);
      const isDis = await loc.first().isDisabled().catch(() => false);
      const outerHtml = await loc.first().evaluate(el => el.outerHTML.slice(0, 150)).catch(() => "");
      console.log(`  Selector "${sel}": count=${count}, visible=${isVis}, disabled=${isDis}`);
      console.log(`    HTML: ${outerHtml}`);
    }
  }

  // Check validation errors before submit
  const preErrors = await page.locator(".error:visible, .field-error:visible, [class*='error']:visible, label + .text-red").allInnerTexts().catch(() => []);
  console.log(`\n📋 Pre-submit validation errors count: ${preErrors.length}`);
  preErrors.forEach(e => console.log(`  - ${e.trim()}`));

  // Scroll to bottom
  console.log("\n📜 Scrolling to bottom of page...");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  await page.waitForTimeout(800);

  const btn = page.locator("#submit_app, input[type='submit'], button[type='submit']").first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);

  console.log("🚀 Testing submit call...");
  // Test dry-run submit
  process.env.DRY_RUN = "true";
  const result = await adapter.submit(page);
  console.log("Submit result:", result);

  const postUrl = page.url();
  console.log("URL after submit:", postUrl);

  const postErrors = await page.locator(".error:visible, .field-error:visible, [class*='error']:visible, label + .text-red").allInnerTexts().catch(() => []);
  console.log(`📋 Post-submit errors count: ${postErrors.length}`);
  postErrors.forEach(e => console.log(`  - ${e.trim()}`));

  await page.waitForTimeout(8000);
  await browser.close();
}

testSubmitButton().catch(console.error);
