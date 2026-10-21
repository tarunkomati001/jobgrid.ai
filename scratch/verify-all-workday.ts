import { db } from '../src/database/db';
import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';
import { WorkdayAdapter } from '../src/ats/workday/workday.adapter';
import { UserProfile, EducationItem, WorkExperienceItem } from '../src/ats/ats.interface';
import { resolveLocalResumePath } from '../src/utils/path-resolver';

async function testJob(url: string, profile: UserProfile, resumePath: string) {
  console.log(`\n======================================================`);
  console.log(`TESTING WORKDAY JOB: ${url}`);
  console.log(`======================================================`);

  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    const adapter = new WorkdayAdapter();
    const additionalAnswers: Record<string, string> = {
      resumePath: resumePath,
      "How did you hear about this opportunity?": "LinkedIn",
      "Notice Period": "Immediate"
    };

    console.log(`Starting fillForm for ${url}...`);
    await adapter.fillForm(page, profile, additionalAnswers);
    console.log(`✅ fillForm successfully completed for: ${url}`);

    await page.screenshot({ path: `scratch/workday_${Date.now()}_finish.png`, fullPage: false });
  } catch (err: any) {
    console.error(`❌ Error filling job: ${err.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
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

  // Test 1: Alcon
  const alconUrl = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  await testJob(alconUrl, profile, resumePath);

  // Test 2: Clario
  const clarioUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293";
  await testJob(clarioUrl, profile, resumePath);

  console.log("\n🎉 ALL TESTS COMPLETED!");
  process.exit(0);
}

main().catch(console.error);
