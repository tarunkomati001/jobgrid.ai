import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  console.log("🚀 Starting Workday full adapter test with user credentials (tarunkomati2@gmail.com / Tarun@143)...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
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
    resumePath: resumePath,
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

  const adapter = new WorkdayAdapter();

  try {
    console.log("Calling adapter.fillForm()...");
    await adapter.fillForm(page, profile, {
      resumePath,
      "How did you hear about this opportunity?": "LinkedIn",
      "Notice Period": "Immediate"
    });

    console.log("Form filling completed! Taking screenshot...");
    await page.screenshot({ path: "scratch/workday_hrutin_filled_success.png", fullPage: true });

    const finalState = await page.evaluate(() => {
      const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
      const header = document.querySelector("h2, h1")?.textContent?.trim() || "";
      const errors = Array.from(document.querySelectorAll(".error, .field-error, [class*='error']:visible, [aria-invalid='true']")).map(e => e.textContent?.trim()).filter(Boolean);
      return { url: window.location.href, activeStep, header, errors };
    });

    console.log("Final State:", JSON.stringify(finalState, null, 2));
  } catch (err: any) {
    console.error("Error during adapter run:", err);
    await page.screenshot({ path: "scratch/workday_run_error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
