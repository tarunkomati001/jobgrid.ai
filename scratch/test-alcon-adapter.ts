import { db } from '../src/database/db';
import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';
import { WorkdayAdapter } from '../src/ats/workday/workday.adapter';
import { UserProfile } from '../src/ats/ats.interface';
import { resolveLocalResumePath } from '../src/utils/path-resolver';
import path from 'path';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const profilesRes = await db.query(
    "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id WHERE u.email = 'babufakemail@gmail.com' LIMIT 1"
  );
  if (profilesRes.rowCount === 0) {
    console.error("No profile found!");
    process.exit(1);
  }
  const row = profilesRes.rows[0];
  const resumePath = resolveLocalResumePath(row.resume_path, row.user_id) || path.resolve(process.cwd(), "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

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
    willingToRelocate: row.willing_to_relocate ?? true,
    yearsOfExperience: row.years_of_experience ?? 2,
    gender: row.gender,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    portfolioUrl: row.portfolio_url,
    experiences: (row.work_experience as any) || [],
    educations: (row.education as any) || [],
    skills: row.skills || [],
    resumePath: resumePath
  };

  console.log("Candidate:", profile.firstName, profile.lastName, "| Resume:", resumePath);

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const adapter = new WorkdayAdapter();

  // Hook to monitor buttons on the page every 3 seconds
  let activeLogs = 0;
  const interval = setInterval(async () => {
    try {
      if (activeLogs++ > 60) return;
      const curUrl = page.url();
      const currentStep = await page.evaluate(() => {
        const active = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
        const header = document.querySelector("h2[data-automation-id='pageHeader'], h2, h3")?.textContent?.trim() || "";
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], [data-automation-id*='button'], [data-automation-id*='Button']"))
          .map(b => ({
            tag: b.tagName,
            text: (b.textContent || "").trim(),
            autoId: b.getAttribute("data-automation-id") || "",
            ariaLabel: b.getAttribute("aria-label") || "",
            visible: (b as HTMLElement).offsetParent !== null
          }))
          .filter(b => b.visible && (b.text || b.autoId || b.ariaLabel));
        return { active, header, buttons };
      });
      console.log(`[STATE] Step: "${currentStep.active}" | Header: "${currentStep.header}" | URL: ${curUrl}`);
      console.log(`[VISIBLE BUTTONS]:`, currentStep.buttons.map(b => `[${b.autoId || b.tag}] "${b.text || b.ariaLabel}"`).join(" | "));
    } catch {}
  }, 3000);

  try {
    await adapter.fillForm(page, profile, { resumePath });
    console.log("Fill Form finished!");
  } finally {
    clearInterval(interval);
    await page.screenshot({ path: "scratch/alcon_debug_state.png", fullPage: true });
    console.log("Screenshot saved to scratch/alcon_debug_state.png");
    await browser.close();
    process.exit(0);
  }
}

main().catch(console.error);
