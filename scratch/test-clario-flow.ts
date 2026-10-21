import { db } from '../src/database/db';
import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';
import { WorkdayAdapter } from '../src/ats/workday/workday.adapter';
import { UserProfile } from '../src/ats/ats.interface';
import { resolveLocalResumePath } from '../src/utils/path-resolver';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const profileRes = await db.query(
    "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id WHERE u.email = 'babufakemail@gmail.com' LIMIT 1"
  );
  if (profileRes.rowCount === 0) {
    console.error("No profile found!");
    process.exit(1);
  }
  const row = profileRes.rows[0];
  const resumePath = resolveLocalResumePath(row.resume_path, row.user_id) || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf";

  const profile: UserProfile = {
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    location: `${row.city || ''}, ${row.state || ''}, ${row.country || 'India'}`.trim(),
    street: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    country: row.country || "India",
    willingToRelocate: true,
    yearsOfExperience: 2,
    gender: row.gender || "Male",
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    portfolioUrl: row.portfolio_url,
    resumePath: resumePath,
    experiences: (row.work_experience as any) || [],
    educations: (row.education as any) || [],
    skills: row.skills || []
  };

  const clarioUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293";
  console.log("Testing Clario full autofill flow...");
  await page.goto(clarioUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const adapter = new WorkdayAdapter();
  await adapter.fillForm(page, profile, {
    resumePath,
    "How did you hear about this opportunity?": "LinkedIn",
    "Notice Period": "Immediate"
  });

  console.log("fillForm finished on Clario! Checking final review state...");
  await page.waitForTimeout(3000);
  const isReview = await page.evaluate(() => {
    return document.body?.innerText?.includes("Review") || document.body?.innerText?.includes("Submit");
  });
  console.log("Reached Review or Submit page?", isReview);

  await page.screenshot({ path: "scratch/clario_wizard_result.png", fullPage: true });
  console.log("Screenshot saved to scratch/clario_wizard_result.png");

  await browser.close();
}

main().catch(console.error);
