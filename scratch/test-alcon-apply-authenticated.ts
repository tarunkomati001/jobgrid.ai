import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const jobUrl = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1";
  console.log("Navigating to job:", jobUrl);
  await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Direct Sign In on header
  const headerSignIn = page.locator("button[data-automation-id='utilityButtonSignIn'], a[data-automation-id='utilityButtonSignIn']").first();
  if (await headerSignIn.count() > 0 && await headerSignIn.isVisible()) {
    console.log("Clicking direct Sign In on header...");
    await headerSignIn.click();
    await page.waitForTimeout(2500);

    const signInTab = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
    if (await signInTab.count() > 0 && await signInTab.isVisible()) {
      await signInTab.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const emailInp = page.locator("input[data-automation-id='email'], input[data-automation-id='userName']").last();
    const pwInp = page.locator("input[data-automation-id='password']").last();
    await emailInp.fill("tarunkomati2@gmail.com");
    await pwInp.fill("Tarun@143");

    const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").last();
    await submitBtn.click({ force: true });
    await pwInp.press("Enter").catch(() => {});
    await page.waitForTimeout(6000);
  }

  await page.screenshot({ path: "scratch/alcon_after_authenticated.png" });
  console.log("Authenticated state verified. Current URL:", page.url());

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "tarunkomati2@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    street: "1/908 aaradhya",
    addressLine2: "limda , wagodhiya",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390144",
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

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  console.log("\nStarting WorkdayAdapter flow with Hrutin details...");
  const adapter = new WorkdayAdapter();
  await adapter.fillForm(page, profile, {
    resumePath,
    "How did you hear about this opportunity?": "LinkedIn",
    "Notice Period": "Immediate"
  });

  await page.screenshot({ path: "scratch/alcon_full_filled_hrutin.png", fullPage: true });
  console.log("Screenshot saved to scratch/alcon_full_filled_hrutin.png");

  await browser.close();
}

main().catch(console.error);
