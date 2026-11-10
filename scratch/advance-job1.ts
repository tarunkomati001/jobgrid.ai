import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";

async function advanceJob1() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);

  const page = await context.newPage();
  const url = "https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.waitForTimeout(3000);

  // Clean modals safely
  await page.evaluate(() => {
    document.querySelectorAll("#onetrust-consent-sdk, [id='0citrus-modal-wrapper'], .modal-backdrop, .modal").forEach(el => el.remove());
    document.body.classList.remove("modal-open");
  });

  // 1. Resume upload
  const resumePath = "C:\\Users\\tarun\\Downloads\\cluco.ai\\cluco.ai\\resumes\\user_usr_hrutin_nammi\\Hrutin_Nammi_Resume.pdf";
  await page.setInputFiles("input#btn-resume, input[type='file']", resumePath).catch(() => {});
  await page.waitForTimeout(1000);

  // Uncheck use attached resume
  const uncheck = page.locator("input#useAttachedResumeToFillOutApplication");
  if (await uncheck.count() > 0 && await uncheck.isChecked()) {
    await uncheck.uncheck().catch(() => {});
  }

  // Basic Info
  await page.locator("input#info\\.firstName, input[id='info.firstName']").fill("Hrutin");
  await page.locator("input#info\\.lastName, input[id='info.lastName']").fill("Nammi");
  await page.locator("input#info\\.preferredName, input[id='info.preferredName']").fill("Hrutin");
  await page.locator("input#info\\.email, input[id='info.email']").fill("babufakemail@gmail.com");
  await page.locator("input#info\\.cellPhone, input[id='info.cellPhone']").fill("+12025550198");

  // Dropdown: Applied before -> No
  const applied = page.locator("[id='info.haveYouAppliedWithUsBefore']").first();
  if (await applied.count() > 0) {
    await applied.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('No'), li:has-text('No')").first().click();
    await page.waitForTimeout(200);
  }

  // Dropdown: SMS -> Yes*
  const sms = page.locator("[id='info.smsOptedIn']").first();
  if (await sms.count() > 0) {
    await sms.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('Yes'), li:has-text('Yes')").first().click();
    await page.waitForTimeout(200);
  }

  // Address
  await page.locator("input#public-site-address-country, input[id='public-site-address-country']").fill("United States");
  await page.locator("input#public-site-address-address-1, input[id='public-site-address-address-1']").fill("123 Market St");
  await page.locator("input#public-site-address-city, input[id='public-site-address-city']").fill("San Francisco");
  await page.locator("input#public-site-address-county, input[id='public-site-address-county']").fill("San Francisco County");
  await page.locator("input#public-site-address-zip, input[id='public-site-address-zip']").fill("94105");

  // State
  const stateInput = page.locator("input[id='public-site-address-us-state']");
  if (await stateInput.count() > 0) {
    await stateInput.click({ force: true });
    await page.waitForTimeout(200);
    await stateInput.type("CA", { delay: 100 });
    await page.waitForTimeout(400);
    const opt = page.locator(".pcty-input-select__menu-list div, div[class*='option']:visible").filter({ hasText: /^CA$/i }).first();
    if (await opt.count() > 0) {
      await opt.evaluate((el: HTMLElement) => el.click());
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);
  }

  // Available date
  await page.locator("input#info\\.dateAvailableToStart, input[id='info.dateAvailableToStart']").fill("11/01/2026");
  await page.locator("input#info\\.linkedIn, input[id='info.linkedIn']").fill("https://linkedin.com/in/hrutinnammi");

  // Desired Salary Type -> Yearly
  const salType = page.locator("[id='info.desiredSalaryType']").first();
  if (await salType.count() > 0) {
    await salType.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('Yearly'), li:has-text('Yearly')").first().click();
    await page.waitForTimeout(200);
  }

  // Salary range
  await page.locator("input#info\\.minimumDesiredSalary, input[id='info.minimumDesiredSalary']").fill("95000");
  await page.locator("input#info\\.maximumDesiredSalary, input[id='info.maximumDesiredSalary']").fill("115000");

  // How did you hear -> Company Website
  const websiteRadio = page.locator("label:has-text('Company Website')").first();
  if (await websiteRadio.count() > 0) {
    await websiteRadio.click();
    await page.waitForTimeout(200);
  }

  // Referred by
  const ref = page.locator("input#info\\.referredBy, input[id='info.referredBy']");
  if (await ref.count() > 0) {
    await ref.fill("Tarun Komati");
  }

  // Skills
  const skillsInput = page.locator("input#info\\.skills, input[id='info.skills']");
  if (await skillsInput.count() > 0) {
    for (const skill of ["TypeScript", "Python", "React", "Node.js", "Docker"]) {
      await skillsInput.fill(skill);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
    }
  }

  // Have you worked with us before -> No
  const worked = page.locator("[id='info.haveYouWorkedWithUsBefore']").first();
  if (await worked.count() > 0) {
    await worked.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('No'), li:has-text('No')").first().click();
    await page.waitForTimeout(200);
  }

  // Education History
  const addEdu = page.locator("button[data-automation-id='btnAddEducationHistory'], button:has-text('Add Education')").first();
  if (await addEdu.count() > 0) {
    await addEdu.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(1000);
  }
  await page.locator("input[id*='educationHistory.name.0']").fill("Parul University");
  await page.locator("input[id*='educationHistory.areaOfStudy.0']").fill("Computer Science Engineering (AI & ML)");

  // School Type -> College / University
  const schoolType = page.locator("div[id*='educationHistory.type.0']").first();
  if (await schoolType.count() > 0) {
    await schoolType.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('College'), li:has-text('College')").first().click();
    await page.waitForTimeout(200);
  }

  // Did you graduate -> Yes
  const didGrad = page.locator("div[id*='educationHistory.didYouGraduate.0']").first();
  if (await didGrad.count() > 0) {
    await didGrad.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('Yes'), li:has-text('Yes')").first().click();
    await page.waitForTimeout(200);
  }

  // Education City & State
  await page.locator("input[id*='educationHistory.city.0']").fill("San Francisco");
  const eduState = page.locator("div[id*='educationHistory.state.0']").first();
  if (await eduState.count() > 0) {
    await eduState.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('California'), li:has-text('California')").first().click();
    await page.waitForTimeout(200);
  }

  // Graduation date
  const gradDate = page.locator("input[id*='educationHistory-graduationDate-0'], input[id*='educationHistory.graduationDate.0']").first();
  if (await gradDate.count() > 0) {
    await gradDate.fill("05/2024");
  }

  // Work History
  const addWork = page.locator("button[data-automation-id='btnAddWorkHistory'], button:has-text('Add Work History')").first();
  if (await addWork.count() > 0) {
    await addWork.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(1000);
  }
  await page.locator("input[id*='workHistory.companyName.0']").fill("Jobspring");
  await page.locator("input[id*='workHistory.position.0']").fill("Full Stack AI Developer");
  await page.locator("input[id*='workHistory.companyUrl.0']").fill("https://github.com/hrutinnammi");
  await page.locator("input[id*='workHistory.companyPhone.0']").fill("+12025550198");
  await page.locator("textarea[id*='workHistory.responsibilities.0']").fill("Designed and implemented scalable FastAPI backend services and React frontend workflows. Built an AI-powered resume generation platform using OpenAI APIs.");
  await page.locator("input[id*='public-candidate-work-history-address-0-country']").fill("United States");
  await page.locator("input[id*='public-candidate-work-history-address-0-address-1']").fill("123 Market St");
  await page.locator("input[id*='public-candidate-work-history-address-0-city']").fill("San Francisco");
  await page.locator("input[id*='public-candidate-work-history-address-0-county']").fill("San Francisco County");
  await page.locator("input[id*='public-candidate-work-history-address-0-zip']").fill("94105");

  // Work state
  const workState = page.locator("input[id*='public-candidate-work-history-address-0-us-state']").first();
  if (await workState.count() > 0) {
    await workState.click({ force: true });
    await page.waitForTimeout(200);
    await workState.type("CA", { delay: 100 });
    await page.waitForTimeout(400);
    const opt = page.locator(".pcty-input-select__menu-list div, div[class*='option']:visible").filter({ hasText: /^CA$/i }).first();
    if (await opt.count() > 0) {
      await opt.evaluate((el: HTMLElement) => el.click());
    } else {
      await page.keyboard.press("Enter");
    }
  }

  // Work Start Date, End Date, Reason
  await page.locator("input[id*='txt-workHistory-startDate-0']").fill("01/01/2024");
  await page.locator("input[id*='txt-workHistory-endDate-0']").fill("01/01/2026");
  await page.locator("input[id*='workHistory.reasonForLeaving.0']").fill("Seeking new technical challenges and professional growth in AI engineering");

  // May we contact supervisor -> Yes
  const contactSup = page.locator("div[id*='workHistory.mayWeContactSupervisor.0']").first();
  if (await contactSup.count() > 0) {
    await contactSup.click();
    await page.waitForTimeout(300);
    await page.locator(".rw-list-option:has-text('Yes'), li:has-text('Yes')").first().click();
    await page.waitForTimeout(200);
  }

  await page.screenshot({ path: "scratch/job1_step1_all_filled.png", fullPage: true });
  console.log("Screenshot before clicking Next: scratch/job1_step1_all_filled.png");

  // Click Next Step
  console.log("Clicking Next Step...");
  const nextBtn = page.locator("button#btn-submit, button:has-text('Next Step')").first();
  await nextBtn.click();
  await page.waitForTimeout(5000);

  // Check new step indicator
  const stepText = await page.locator("p:has-text('Step'), [class*='step']").first().innerText().catch(() => "Unknown");
  console.log(`Current Step after Next Step: "${stepText}"`);

  // Check validation errors if any
  const errors = await page.locator(".has-error, .text-danger, span[style*='color: red'], .field-validation-error").allInnerTexts().catch(() => []);
  console.log("Validation errors after advance:", errors.filter(e => e.trim().length > 0));

  await page.screenshot({ path: "scratch/job1_step2_reached.png", fullPage: true });
  console.log("Screenshot after clicking Next: scratch/job1_step2_reached.png");

  // Extract all elements on Step 2
  const step2Fields = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("input, select, textarea, div.rw-dropdownlist"));
    return els.map(el => {
      const id = el.id || "";
      const name = (el as any).name || "";
      const dataFor = el.getAttribute("data-for") || "";
      const formGroup = el.closest(".form-group, .card, fieldset");
      const parentLabel = formGroup?.querySelector("label, legend")?.textContent?.trim() || "";
      const tagName = el.tagName.toLowerCase();
      const type = (el as any).type || el.getAttribute("role") || tagName;
      const isVisible = (el as HTMLElement).offsetParent !== null;
      return { id, name, dataFor, parentLabel, type, isVisible };
    }).filter(f => f.isVisible && !f.id.includes("ot-group") && !f.id.includes("vendor-search"));
  });

  fs.writeFileSync("scratch/job1_step2_fields.json", JSON.stringify(step2Fields, null, 2));
  console.log(`Step 2 fields found (${step2Fields.length}):`);
  step2Fields.forEach(f => {
    console.log(`  - [${f.type}] ID="${f.id}" | ${f.parentLabel || f.dataFor || f.name || f.id}`);
  });

  await browser.close();
}

advanceJob1().catch(console.error);
