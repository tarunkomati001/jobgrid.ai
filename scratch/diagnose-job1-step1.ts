import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { db } from "../src/database/db";
import { UserProfile } from "../src/ats/ats.interface";
import { resolveLocalResumePath } from "../src/utils/path-resolver";

async function diagnose() {
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
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Cookie banner
  const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Run the adapter's fillForm
  const adapter = new PaylocityAdapter();
  await adapter.fillForm(page, profile);

  // Check validation errors
  const errors = await page.evaluate(() => {
    const errElements = Array.from(document.querySelectorAll(".has-error, .text-danger, span[style*='color: red'], .field-validation-error, [class*='error']"));
    return errElements
      .map(el => (el.textContent || "").trim())
      .filter(t => t.length > 0 && !t.includes("Accept All Cookies") && !t.includes("Skip to"));
  });

  console.log("Validation errors found:", errors);

  // Check which fields have invalid state
  const invalidInputs = await page.evaluate(() => {
    const inps = Array.from(document.querySelectorAll("input, select, textarea, .rw-dropdownlist"));
    return inps.filter(el => {
      const parent = el.closest(".has-error");
      const ariaInv = el.getAttribute("aria-invalid") === "true";
      const isReq = (el as any).required || el.getAttribute("aria-required") === "true";
      return parent !== null || ariaInv;
    }).map(el => ({
      id: el.id,
      name: (el as any).name,
      label: el.closest(".form-group")?.querySelector("label")?.textContent?.trim(),
      val: (el as any).value || el.textContent?.trim()
    }));
  });

  console.log("Invalid fields:", invalidInputs);

  const stepText = await page.locator("p:has-text('Step')").first().innerText().catch(() => "");
  console.log("Current Step indicator:", stepText);

  await page.screenshot({ path: "scratch/job1_step_diagnose.png", fullPage: true });
  console.log("Screenshot saved to scratch/job1_step_diagnose.png");

  await browser.close();
  await db.close();
}

diagnose().catch(console.error);
