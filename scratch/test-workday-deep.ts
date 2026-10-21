import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";
import * as fs from "fs";

async function testJob(url: string, jobLabel: string) {
  console.log(`\n======================================================================`);
  console.log(`🧪 TESTING WORKDAY JOB: ${jobLabel}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`======================================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();
  const adapter = new WorkdayAdapter();

  const timestamp = Date.now();
  const testEmail = `babufakemail+wd${timestamp}@gmail.com`;

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
    websites: ["https://www.linkedin.com/in/hrutinnammi", "https://github.com/hrutinnammi"],
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const additionalAnswers: Record<string, string> = {
    resumePath: profile.resumePath!,
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
    "English": "Fluent",
    "Referral": "Tarun Komati",
    "Reference": "Tarun Komati"
  };

  try {
    console.log(`🌐 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    const detected = await adapter.detect(page);
    console.log(`🔍 ATS Detection: ${detected ? "PASSED (Workday detected)" : "FAILED"}`);

    // Call fillForm directly (caller order test: fillForm will handle auth and resume upload internally)
    console.log(`✍️ Executing adapter.fillForm()...`);
    await adapter.fillForm(page, profile, additionalAnswers);

    // Call uploadResume (as callers like headed-autofill.ts and workers do)
    console.log(`📂 Calling adapter.uploadResume() to ensure idempotent / backward-compatible call...`);
    await adapter.uploadResume(page, profile.resumePath!, [], profile);

    // Take screenshot of current state
    const currentUrl = page.url();
    console.log(`📍 Current URL after fillForm & uploadResume: ${currentUrl}`);

    await page.screenshot({ path: `scratch/${jobLabel}_result.png`, fullPage: true });

    // Validate form status
    const isValid = await adapter.validate(page);
    console.log(`✅ adapter.validate(): ${isValid}`);

    // Check submission readiness
    const submitResult = await adapter.submit(page);
    console.log(`🏁 adapter.submit() result:`, JSON.stringify(submitResult, null, 2));

    console.log(`🎉 COMPLETED TEST FOR ${jobLabel}`);
    return { success: true, submitResult, isValid };
  } catch (err: any) {
    console.error(`❌ Error in test ${jobLabel}:`, err.message);
    await page.screenshot({ path: `scratch/${jobLabel}_error.png`, fullPage: true }).catch(() => {});
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

async function run() {
  const jobs = [
    {
      label: "clario_medical_imaging",
      url: "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1"
    },
    {
      label: "alcon_calibration",
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Associate-I--Instrumentation---Calibration-Technical-Support_R-2026-49466-1?codes=IND"
    }
  ];

  for (const job of jobs) {
    await testJob(job.url, job.label);
  }
}

run();
