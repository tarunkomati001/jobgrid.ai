import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import { GreenhouseAdapter } from "../src/ats/greenhouse/greenhouse.adapter";
import { UserProfile } from "../src/ats/ats.interface";

async function testRealGreenhouseAdapterFlow() {
  console.log("🚀 Testing real GreenhouseAdapter flow as called by application-worker...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);

  const adapter = new GreenhouseAdapter();
  const fields = await adapter.extractFields(page);
  console.log(`\n📋 Extracted ${fields.length} fields:`);
  fields.forEach((f, i) => {
    console.log(`  ${i + 1}. [${f.type}] id="${f.id}" label="${f.label}" req=${f.required}`);
  });

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Kumar",
    email: "babufakemail@gmail.com",
    phone: "+91 86884 23267",
    location: "Vadodara, Gujarat, India",
    linkedinUrl: "https://linkedin.com/in/hrutinkumar",
    githubUrl: "https://github.com/hrutinkumar",
  };

  console.log("\n🚀 Calling adapter.fillForm()...");
  await adapter.fillForm(page, profile, {}, fields);

  console.log("\n🔍 Checking for required error banners on page...");
  const errors = await page.locator(".error, .field-error, [class*='error']:visible, label + .text-red, .text-red-500, [aria-invalid='true']").allInnerTexts().catch(() => []);
  console.log("Errors detected:", errors);

  await page.waitForTimeout(8000);
  await browser.close();
}

testRealGreenhouseAdapterFlow().catch(console.error);
