import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Associate-I--Instrumentation---Calibration-Technical-Support_R-2026-49466-1?codes=IND";
  console.log("Testing Alcon job:", url);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();
  const adapter = new WorkdayAdapter();

  const testEmail = "babufakemail@gmail.com";

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: testEmail,
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
    linkedinUrl: "https://www.linkedin.com/in/hrutinnammi",
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
        description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users."
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
    websites: ["https://www.linkedin.com/in/hrutinnammi", "https://github.com/hrutinnammi"],
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const additionalAnswers: Record<string, string> = {
    resumePath: profile.resumePath!,
    "How did you hear about this opportunity?": "LinkedIn",
    "Notice Period": "Immediate",
    "Current Notice Period": "Immediate",
    "Expected Salary": "Negotiable",
    "English language skills": "Fluent / Professional Working Proficiency"
  };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    console.log("Calling adapter.fillForm()...");
    await adapter.fillForm(page, profile, additionalAnswers);

    await page.screenshot({ path: "scratch/alcon_deep_after_fillform.png", fullPage: true });

    const isValid = await adapter.validate(page);
    console.log("Validate result:", isValid);

    const sub = await adapter.submit(page);
    console.log("Submit result:", JSON.stringify(sub, null, 2));

  } catch (err: any) {
    console.error("Error in Alcon test:", err.message);
    await page.screenshot({ path: "scratch/alcon_deep_error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
