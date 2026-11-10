import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { detectAndGetAdapter } from "../src/ats/ats-factory";
import { db } from "../src/database/db";
import { UserProfile } from "../src/ats/ats.interface";
import { resolveLocalResumePath } from "../src/utils/path-resolver";

async function testJob2Advance() {
  const userRes = await db.query("SELECT * FROM users WHERE email = 'babufakemail@gmail.com' OR id = 'usr_hrutin_nammi'");
  const user = userRes.rows[0];
  const profRes = await db.query("SELECT * FROM user_profiles WHERE user_id = $1", [user.id]);
  const p = profRes.rows[0];
  const resumeRes = await db.query("SELECT * FROM resumes WHERE user_id = $1 AND (resume_type = 'PDF' OR resume_type IS NULL)", [user.id]);
  const resumePath = resolveLocalResumePath(resumeRes.rows[0]?.file_path || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  const profile: UserProfile = {
    userId: user.id,
    firstName: p.first_name,
    lastName: p.last_name,
    middleName: "",
    email: user.email,
    phone: p.phone,
    location: p.location,
    street: "123 Market St",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    linkedinUrl: p.linkedin_url || "https://linkedin.com/in/hrutinnammi",
    githubUrl: p.github_url || "https://github.com/hrutinnammi",
    portfolioUrl: p.portfolio_url || "https://linkedin.com/in/hrutinnammi",
    willingToRelocate: Boolean(p.willing_to_relocate),
    yearsOfExperience: p.years_of_experience || 2,
    gender: p.gender || "Male",
    resumePath: resumePath
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048";
  console.log(`Navigating to Job 2: ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const { adapter } = await detectAndGetAdapter(page, url);

  // Run extractFields
  console.log("Calling fillForm...");
  await adapter.fillForm(page, profile);

  await page.screenshot({ path: "scratch/job2_after_fillForm.png", fullPage: true });
  console.log("Screenshot taken: scratch/job2_after_fillForm.png");

  // Check what step it is currently on
  const stepText = await page.locator("p:has-text('Step')").allInnerTexts();
  console.log("Current step indicator:", stepText);

  // Check visible validation errors
  const errors = await page.locator(".has-error, [style*='color: red'], .field-validation-error, .text-danger, .type-error").allInnerTexts();
  console.log("Validation errors on page:", errors);

  await browser.close();
  await db.close();
}

testJob2Advance().catch(console.error);
