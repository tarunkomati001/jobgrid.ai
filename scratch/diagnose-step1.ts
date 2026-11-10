import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

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
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Fill form Step 1
  await adapter.fillForm(page, profile);

  // Take full page screenshot
  await page.screenshot({ path: "scratch/step1_diagnosis.png", fullPage: true });

  // Check any validation error messages on page
  const errors = await page.evaluate(() => {
    const errEls = Array.from(document.querySelectorAll(".text-danger, .has-error, .error, span[style*='color: red'], [class*='error'], [aria-invalid='true']"));
    return errEls.map(el => ({
      text: el.textContent?.trim(),
      tag: el.tagName,
      className: el.className,
      parent: el.closest(".form-group, .card")?.querySelector("label, legend")?.textContent?.trim()
    })).filter(e => e.text && e.text.length > 0);
  });

  console.log("VALIDATION ERRORS FOUND:", JSON.stringify(errors, null, 2));

  // Check all cards present
  const cards = await page.evaluate(() => {
    const eduCards = Array.from(document.querySelectorAll("[id*='educationHistory']"));
    const workCards = Array.from(document.querySelectorAll("[id*='workHistory']"));
    return {
      eduIds: eduCards.map(c => c.id),
      workIds: workCards.map(c => c.id)
    };
  });

  console.log("CARDS COUNT:", {
    edu: cards.eduIds.length,
    work: cards.workIds.length
  });

  await browser.close();
}

diagnose().catch(console.error);
