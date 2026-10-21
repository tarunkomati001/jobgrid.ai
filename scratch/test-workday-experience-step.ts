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

  console.log("Navigating to active job:", activeUrl);
  await page.goto(activeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(4000);

  // Click Apply Manually
  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually'], [role='button']:has-text('Apply Manually')").first();
  if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    console.log("Clicking Apply Manually...");
    await applyManually.click({ force: true });
  }

  console.log("Waiting for auth form to mount...");
  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 20000 });
  await page.waitForTimeout(2000);

  const testEmail = `babufakemail+clario${Date.now()}@gmail.com`;
  const testPw = "Tarun@2026!Aa";

  const hasVerifyPw = (await page.locator("input[data-automation-id='verifyPassword']").count()) > 0;
  if (!hasVerifyPw) {
    const createLink = page.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], button:has-text('Create Account'), a:has-text('Create Account')").first();
    if (await createLink.count() > 0) {
      await createLink.click({ force: true });
      await page.waitForSelector("input[data-automation-id='verifyPassword']", { timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  }

  console.log(`Filling Create Account details: ${testEmail}...`);
  await page.locator("input[data-automation-id='email']").first().fill(testEmail);
  await page.locator("input[data-automation-id='password']").first().fill(testPw);
  await page.locator("input[data-automation-id='verifyPassword']").first().fill(testPw);

  const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
  if (await cb.count() > 0 && !await cb.isChecked()) {
    await cb.check({ force: true });
  }

  const createBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
  await createBtn.click({ force: true });
  console.log("Clicked Create Account button. Waiting for Step 1...");
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
        description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications. Reduced API response latency by 30% through database query optimization and backend performance improvements. Containerized and deployed applications using Docker and Azure App Service, reducing deployment time by 60%."
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
        description: "Delivered full-stack features for a travel-tech platform serving customer-facing applications. Built scalable backend APIs and responsive frontend interfaces using modern development practices. Integrated third-party APIs for itinerary generation and workflow automation."
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

  // Close any drawer
  const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
  if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
    await closeDrawer.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // 1. Fill Step 1
  console.log("Filling Step 1 (My Information)...");
  await (adapter as any).fillSourceDropdown(page);
  await (adapter as any).fillPreviouslyWorkedQuestion(page);
  await (adapter as any).fillPersonalInfoFields(page, profile);
  await (adapter as any).formatNamesToTitleCase(page, profile);
  await (adapter as any).fillAddressAndContact(page, profile);
  await (adapter as any).cleanAndFillPhoneNumber(page, profile);

  // Phone Device Type dropdown
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

  await (adapter as any).remedyWorkdayErrorsAndAlerts(page, profile);
  await page.screenshot({ path: "scratch/clario_step1_filled.png", fullPage: true });

  // Click Save and Continue
  console.log("Clicking Save and Continue to reach Step 2 (My Experience)...");
  const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);

  // Auto-remedy if alerts
  await (adapter as any).remedyWorkdayErrorsAndAlerts(page, profile);

  // If still on step 1, re-click
  const activeStep = await page.evaluate(() => document.querySelector("[data-automation-id='progressBarActiveStep'], h2")?.textContent?.trim() || "");
  console.log("Active step after click:", activeStep);
  if (activeStep.toLowerCase().includes("information")) {
    console.log("Re-clicking Next...");
    await nextBtn.click({ force: true });
    await page.waitForTimeout(6000);
  }

  console.log("--- REACHED STEP 2 ---");
  console.log("Current URL on Step 2:", page.url());
  await page.screenshot({ path: "scratch/clario_step2_experience_screen.png", fullPage: true });

  // Dump all DOM elements on Step 2
  const step2Elements = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, [data-automation-id*='Section'], [data-automation-id*='section']")).map(h => ({
      tag: h.tagName,
      autoId: h.getAttribute("data-automation-id"),
      text: h.textContent?.trim()?.slice(0, 100)
    }));
    const buttons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
      tag: b.tagName,
      autoId: b.getAttribute("data-automation-id"),
      ariaLabel: b.getAttribute("aria-label"),
      text: b.textContent?.trim()?.slice(0, 100)
    }));
    const inputs = Array.from(document.querySelectorAll("input, textarea, select")).map(i => ({
      tag: i.tagName,
      autoId: i.getAttribute("data-automation-id"),
      id: i.id,
      name: (i as HTMLInputElement).name,
      type: (i as HTMLInputElement).type,
      placeholder: (i as HTMLInputElement).placeholder,
      ariaLabel: i.getAttribute("aria-label"),
      val: (i as HTMLInputElement).value
    }));
    return { headings, buttons, inputs };
  });

  console.log("STEP 2 HEADINGS:", JSON.stringify(step2Elements.headings, null, 2));
  console.log("STEP 2 BUTTONS:", JSON.stringify(step2Elements.buttons, null, 2));
  console.log("STEP 2 INPUTS:", JSON.stringify(step2Elements.inputs, null, 2));

  await browser.close();
}

main().catch(console.error);
