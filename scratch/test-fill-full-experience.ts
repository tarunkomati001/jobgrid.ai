import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";

async function main() {
  const activeUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300-1";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto(activeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually'], [role='button']:has-text('Apply Manually')").first();
  if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    await applyManually.click({ force: true });
  }

  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 20000 });
  await page.waitForTimeout(2000);

  const testEmail = `babufakemail+clario${Date.now()}@gmail.com`;
  const testPw = "Tarun@2026!Aa";

  const hasVerifyPw = (await page.locator("input[data-automation-id='verifyPassword']").count()) > 0;
  if (!hasVerifyPw) {
    const createLink = page.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], button:has-text('Create Account')").first();
    if (await createLink.count() > 0) {
      await createLink.click({ force: true });
      await page.waitForSelector("input[data-automation-id='verifyPassword']", { timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  }

  await page.locator("input[data-automation-id='email']").first().fill(testEmail);
  await page.locator("input[data-automation-id='password']").first().fill(testPw);
  await page.locator("input[data-automation-id='verifyPassword']").first().fill(testPw);

  const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
  if (await cb.count() > 0 && !await cb.isChecked()) {
    await cb.check({ force: true });
  }

  const createBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
  await createBtn.click({ force: true });
  await page.waitForTimeout(10000);

  const adapter = new WorkdayAdapter();
  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: testEmail,
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    street: "1/908 aaradhya",
    addressLine2: "limda",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390001",
    country: "India",
    willingToRelocate: true,
    workAuthorization: "Yes",
    yearsOfExperience: 2,
    gender: "Male",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    portfolioUrl: "https://github.com/hrutinnammi",
    experiences: [
      {
        jobTitle: "Full Stack AI Developer",
        company: "Jobspring",
        location: "Vadodara, Gujarat, India",
        currentlyWorkHere: true,
        startDate: "01/2024",
        startMonth: "01",
        startYear: "2024",
        endDate: "01/2026",
        endMonth: "01",
        endYear: "2026",
        description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications."
      },
      {
        jobTitle: "Full Stack Developer",
        company: "Nomadic Trails",
        location: "Remote",
        currentlyWorkHere: false,
        startDate: "09/2025",
        startMonth: "09",
        startYear: "2025",
        endDate: "10/2025",
        endMonth: "10",
        endYear: "2025",
        description: "Delivered full-stack features for a travel-tech platform serving customer-facing applications. Built scalable backend APIs and responsive frontend interfaces using modern development practices."
      }
    ],
    educations: [
      {
        school: "Parul University",
        degree: "Bachelor of Technology",
        fieldOfStudy: "Computer Science and Engineering",
        gpa: "7.1",
        startDate: "08/2023",
        startYear: "2023",
        endDate: "06/2027",
        endYear: "2027"
      }
    ],
    skills: ["Python", "FastAPI", "React", "JavaScript", "Docker", "REST APIs", "MySQL", "MongoDB", "Git", "Azure", "NLP", "RAG"],
    websites: ["https://linkedin.com/in/hrutinnammi", "https://github.com/hrutinnammi"]
  };

  // Close drawer
  const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
  if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
    await closeDrawer.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Step 1
  await (adapter as any).fillSourceDropdown(page);
  await (adapter as any).fillPreviouslyWorkedQuestion(page);
  await (adapter as any).fillPersonalInfoFields(page, profile);
  await (adapter as any).formatNamesToTitleCase(page, profile);
  await (adapter as any).fillAddressAndContact(page, profile);
  await (adapter as any).cleanAndFillPhoneNumber(page, profile);

  const phoneTypeBtn = page.locator("button[data-automation-id='phone-device-type'], button[id*='phone-device-type'], div[data-automation-id*='phone-device-type'] button").first();
  if (await phoneTypeBtn.count() > 0 && await phoneTypeBtn.isVisible().catch(() => false)) {
    const curVal = await phoneTypeBtn.innerText().catch(() => "");
    if (!curVal || curVal.includes("Select One") || curVal.includes("Select")) {
      await phoneTypeBtn.click();
      await page.waitForTimeout(500);
      const mob = page.locator("[role='option']:has-text('Mobile'), li:has-text('Mobile')").first();
      if (await mob.count() > 0) await mob.click({ force: true });
      await page.waitForTimeout(300);
    }
  }

  // Click Save and Continue
  await page.locator("button:has-text('Save and Continue')").last().click({ force: true });
  await page.waitForTimeout(6000);

  console.log("--- NOW ON STEP 2: FILLING EXPERIENCE & EDUCATION ---");

  // Fill Work Experience
  console.log("Filling Work Experience...");
  const clickSectionAdd = async (sectionHeading: string) => {
    return await page.evaluate((headingText) => {
      const h4s = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, [role='heading']"));
      const h = h4s.find(el => el.textContent?.trim().toLowerCase().includes(headingText.toLowerCase()));
      if (!h) return false;
      let next = h.nextElementSibling;
      while (next) {
        const btn = next.querySelector("button") || (next.tagName === "BUTTON" ? next : null);
        if (btn && (btn.textContent?.trim().includes("Add") || btn.getAttribute("data-automation-id") === "add-button")) {
          (btn as HTMLButtonElement).click();
          return true;
        }
        next = next.nextElementSibling;
      }
      return false;
    }, sectionHeading);
  };

  // Add 1st Work Experience
  await clickSectionAdd("Work Experience");
  await page.waitForTimeout(1500);

  // Fill Experience 1
  const exp1 = profile.experiences![0];
  const title1 = page.locator("input[id*='jobTitle'], input[name='jobTitle']").first();
  await title1.fill(exp1.jobTitle);

  const comp1 = page.locator("input[id*='companyName'], input[name='companyName']").first();
  await comp1.fill(exp1.company);

  const loc1 = page.locator("input[id*='workExperience'][id*='location'], input[name='location']").first();
  await loc1.fill(exp1.location || "Vadodara, Gujarat, India");

  if (exp1.currentlyWorkHere) {
    const currCb1 = page.locator("input[type='checkbox'][id*='currentlyWorkHere'], input[type='checkbox'][name='currentlyWorkHere']").first();
    if (await currCb1.count() > 0 && !(await currCb1.isChecked())) {
      await currCb1.check({ force: true });
    }
  }

  // Start Date: Month & Year
  const startMonth1 = page.locator("input[id*='startDate-dateSectionMonth-input'], input[data-automation-id='dateSectionMonth-input']").first();
  if (await startMonth1.count() > 0) {
    await startMonth1.fill(exp1.startMonth || "01");
  }
  const startYear1 = page.locator("input[id*='startDate-dateSectionYear-input'], input[data-automation-id='dateSectionYear-input']").first();
  if (await startYear1.count() > 0) {
    await startYear1.fill(exp1.startYear || "2024");
  }

  // End Date: Month & Year (if not currently working here, or if required)
  const endMonth1 = page.locator("input[id*='endDate-dateSectionMonth-input']").first();
  if (await endMonth1.count() > 0 && await endMonth1.isVisible()) {
    await endMonth1.fill(exp1.endMonth || "01");
  }
  const endYear1 = page.locator("input[id*='endDate-dateSectionYear-input']").first();
  if (await endYear1.count() > 0 && await endYear1.isVisible()) {
    await endYear1.fill(exp1.endYear || "2026");
  }

  if (exp1.description) {
    const desc1 = page.locator("textarea[id*='roleDescription']").first();
    await desc1.fill(exp1.description);
  }

  // Add 2nd Work Experience Card
  const addAnotherExpBtn = page.locator("button:has-text('Add Another')").first();
  if (await addAnotherExpBtn.count() > 0) {
    console.log("Adding 2nd Work Experience card...");
    await addAnotherExpBtn.click({ force: true });
    await page.waitForTimeout(1500);

    const exp2 = profile.experiences![1];
    const title2 = page.locator("input[id*='jobTitle'], input[name='jobTitle']").nth(1);
    await title2.fill(exp2.jobTitle);

    const comp2 = page.locator("input[id*='companyName'], input[name='companyName']").nth(1);
    await comp2.fill(exp2.company);

    const loc2 = page.locator("input[id*='workExperience'][id*='location'], input[name='location']").nth(1);
    await loc2.fill(exp2.location || "Remote");

    const startMonth2 = page.locator("input[id*='startDate-dateSectionMonth-input']").nth(1);
    if (await startMonth2.count() > 0) await startMonth2.fill(exp2.startMonth || "09");
    const startYear2 = page.locator("input[id*='startDate-dateSectionYear-input']").nth(1);
    if (await startYear2.count() > 0) await startYear2.fill(exp2.startYear || "2025");

    const endMonth2 = page.locator("input[id*='endDate-dateSectionMonth-input']").nth(1);
    if (await endMonth2.count() > 0 && await endMonth2.isVisible()) await endMonth2.fill(exp2.endMonth || "10");
    const endYear2 = page.locator("input[id*='endDate-dateSectionYear-input']").nth(1);
    if (await endYear2.count() > 0 && await endYear2.isVisible()) await endYear2.fill(exp2.endYear || "2025");

    if (exp2.description) {
      const desc2 = page.locator("textarea[id*='roleDescription']").nth(1);
      await desc2.fill(exp2.description);
    }
  }

  // Fill Education
  console.log("Filling Education...");
  await clickSectionAdd("Education");
  await page.waitForTimeout(1500);

  const edu = profile.educations![0];
  const schoolInp = page.locator("input[id*='schoolName'], input[name='schoolName'], input[data-automation-id='school']").first();
  await schoolInp.fill(edu.school);

  // Degree button dropdown
  const degreeBtn = page.locator("button[id*='degree'], button[data-automation-id='degree']").first();
  if (await degreeBtn.count() > 0 && await degreeBtn.isVisible()) {
    console.log("Selecting Degree dropdown...");
    await degreeBtn.click({ force: true });
    await page.waitForTimeout(600);
    const searchInp = page.locator("input[data-automation-id='searchBox'], div[data-automation-id='promptPopup'] input, input[placeholder*='Search']").first();
    if (await searchInp.count() > 0) {
      await searchInp.fill("Bachelor");
      await searchInp.press("Enter");
      await page.waitForTimeout(800);
    }
    const opt = page.locator("[role='option']:has-text('Bachelor'), div[data-automation-id='promptOption']:has-text('Bachelor'), [role='option']:not(:has-text('Select One'))").first();
    if (await opt.count() > 0) await opt.click({ force: true });
    await page.waitForTimeout(400);
  }

  // Field of study input
  const fieldInp = page.locator("input[id*='fieldOfStudy'], input[data-automation-id='field-of-study']").first();
  if (await fieldInp.count() > 0 && await fieldInp.isVisible()) {
    console.log("Selecting Field of Study...");
    await fieldInp.fill("Computer Science");
    await page.waitForTimeout(500);
    await fieldInp.press("Enter");
    await page.waitForTimeout(600);
    const opt = page.locator("[role='option']:has-text('Computer Science'), div[data-automation-id='promptOption']:has-text('Computer Science')").first();
    if (await opt.count() > 0) await opt.click({ force: true });
    await page.waitForTimeout(400);
  }

  // GPA
  const gpaInp = page.locator("input[id*='gradeAverage'], input[name='gradeAverage']").first();
  if (await gpaInp.count() > 0 && await gpaInp.isVisible()) {
    await gpaInp.fill(edu.gpa || "7.1");
  }

  // Fill Skills
  console.log("Filling Skills...");
  const skillsInp = page.locator("input[id*='skills--skills'], input[placeholder*='Search' i]").first();
  if (await skillsInp.count() > 0 && await skillsInp.isVisible()) {
    for (const skill of ["Python", "React", "FastAPI"]) {
      await skillsInp.fill(skill);
      await page.waitForTimeout(500);
      await skillsInp.press("Enter");
      await page.waitForTimeout(600);
      const opt = page.locator(`[role='option']:has-text('${skill}'), div[data-automation-id='promptOption']:has-text('${skill}')`).first();
      if (await opt.count() > 0) await opt.click({ force: true });
      await page.waitForTimeout(300);
    }
  }

  // Fill Websites
  console.log("Filling Websites...");
  await clickSectionAdd("Websites");
  await page.waitForTimeout(1000);
  const webInp1 = page.locator("input[id*='webAddress'], input[name='url']").first();
  if (await webInp1.count() > 0 && await webInp1.isVisible()) {
    await webInp1.fill(profile.websites![0]);
  }

  // Fill Social Network URLs
  const linkedinInp = page.locator("input[id*='socialNetworkAccounts--linkedInAccount'], input[name='linkedInAccount']").first();
  if (await linkedinInp.count() > 0 && await linkedinInp.isVisible()) {
    await linkedinInp.fill(profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi");
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/clario_step2_fully_filled.png", fullPage: true });
  console.log("Saved screenshot: scratch/clario_step2_fully_filled.png");

  // Now click Save and Continue to see if it advances cleanly to Step 3!
  console.log("Clicking Save and Continue from Step 2 to Step 3...");
  const nextBtn2 = page.locator("button:has-text('Save and Continue'), button[data-automation-id='pageFooterNextButton']").last();
  await nextBtn2.click({ force: true });
  await page.waitForTimeout(7000);

  console.log("URL after Step 2 submission:", page.url());
  const activeStep3 = await page.evaluate(() => document.querySelector("[data-automation-id='progressBarActiveStep'], h2, h3")?.textContent?.trim() || "");
  console.log("Active step after Step 2:", activeStep3);
  await page.screenshot({ path: "scratch/clario_step3_reached.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
