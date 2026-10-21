import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300-1";
  console.log("Testing WorkdayAdapter on:", testUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const adapter = new WorkdayAdapter();

  const uniqueEmail = `babufakemail+clario${Date.now()}@gmail.com`;
  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: uniqueEmail,
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

  const additionalAnswers: Record<string, string> = {
    "How did you hear about this opportunity?": "LinkedIn",
    "Notice Period": "Immediate",
    "Current Notice Period": "Immediate",
    "What is your current notice period?": "Immediate",
    "Expected Salary": "Negotiable",
    "Desired Salary": "Negotiable",
    "Current Salary": "Negotiable",
    "What is your current gross monthly salary?": "Negotiable",
    "What are gross monthly salary expectations?": "Negotiable",
    "English language skills": "Fluent / Professional Working Proficiency",
    "How would you describe your English language skills?": "Fluent / Professional Working Proficiency",
    "English": "Fluent"
  };

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  try {
    console.log("Navigating to test job...");
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    console.log("1. Running uploadResume...");
    await adapter.uploadResume(page, resumePath, [], profile);
    await page.screenshot({ path: "scratch/adapter_after_upload.png" }).catch(() => {});

    console.log("2. Running fillForm...");
    await adapter.fillForm(page, profile, additionalAnswers);
    await page.screenshot({ path: "scratch/adapter_after_fillform.png", fullPage: true }).catch(() => {});

    console.log("3. Running submit (manual mode check)...");
    const res = await adapter.submit(page);
    console.log("Submission result:", res);

    await page.screenshot({ path: "scratch/workday_adapter_final.png", fullPage: true });
    console.log("✅ WorkdayAdapter direct test completed successfully!");
  } catch (err: any) {
    console.error("❌ Error in WorkdayAdapter test:", err.message);
    await page.screenshot({ path: "scratch/workday_adapter_error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main();
