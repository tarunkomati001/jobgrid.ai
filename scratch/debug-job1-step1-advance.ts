import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

async function debugAdvance() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  // Listen to network responses from Paylocity API
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("Step") || url.includes("Apply") || url.includes("Validate") || url.includes("Save")) {
      const status = res.status();
      const body = await res.text().catch(() => "");
      console.log(`🌐 [RESPONSE ${status}] ${url}`);
      if (status >= 400 || body.includes("error") || body.includes("Error") || body.includes("false")) {
        console.log(`   Response Body: ${body.slice(0, 300)}`);
      }
    }
  });

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "+12025550198",
    street: "123 Market St",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const adapter = new PaylocityAdapter();
  console.log("Navigating to Job 1...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Fill form
  await adapter.fillForm(page, profile);

  // Take screenshot of step 1 after fill
  await page.screenshot({ path: "scratch/debug_step1_filled.png", fullPage: true });

  // Check any validation errors
  const errors = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("span[style*='color: red'], p.text-danger, .has-error, .field-validation-error"));
    return all.map(el => el.textContent?.trim()).filter(Boolean);
  });
  console.log("VALIDATION ERRORS AFTER FILL:", errors);

  const stepIndicator = await page.locator("p:has-text('Step')").first().innerText().catch(() => "");
  console.log("CURRENT STEP INDICATOR:", stepIndicator);

  await browser.close();
}

debugAdvance().catch(console.error);
