/**
 * Lever Graphic Zig-Zag Human Mouse & Form Validation Test
 * 
 * Tests Lever ATS application flow with:
 * 1. Graphic Zig-Zag Human Mouse Physics Engine (Bezier curves, harmonic oscillations, micro-tremor, Fitts's law)
 * 2. Real resume PDF upload
 * 3. Human input and radio/checkbox selection
 * 4. Pre-submit zig-zag review sweeps to build authentic anti-bot telemetry
 * 5. Submission interaction with hCaptcha monitoring
 */

import path from "path";
import fs from "fs";
import { createBrowser, createPersistentBrowserContext, applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { LeverAdapter } from "../src/ats/lever/lever.adapter";
import { UserProfile } from "../src/ats/ats.interface";

// Explicitly set DRY_RUN=false for live submission test
process.env.DRY_RUN = "false";

const TARGET_JOB_URL = process.env.LEVER_JOB_URL || "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply";

const HRUTIN_PROFILE: UserProfile = {
  userId: "usr_hrutin_nammi",
  firstName: "Hrutin",
  lastName: "Kumar",
  email: "babufakemail@gmail.com",
  phone: "+91 86884 23267",
  location: "Vadodara, Gujarat, India",
  linkedinUrl: "https://linkedin.com/in/hrutinnammi",
  githubUrl: "https://github.com/hrutinnammi",
  portfolioUrl: "https://github.com/hrutinnammi",
  willingToRelocate: true,
  yearsOfExperience: 3,
  gender: "Male"
};

const RESUME_PATH = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function runLeverTest() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║         ⚡ CLUCO.AI - LEVER GRAPHIC ZIG-ZAG MOUSE TEST                 ║
║   Testing natural non-linear trajectories on Lever ATS with hCaptcha   ║
╚════════════════════════════════════════════════════════════════════════╝
Target Job: ${TARGET_JOB_URL}
Resume: ${RESUME_PATH}
`);

  if (!fs.existsSync(RESUME_PATH)) {
    console.error(`❌ Resume file not found at: ${RESUME_PATH}`);
    process.exit(1);
  }

  // Create screenshots directory
  const screenshotsDir = path.resolve(__dirname, "../screenshots");
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  console.log("🌐 Launching browser in headed mode to observe graphic zig-zag mouse movements...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 },
    locale: "en-US"
  });

  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    const adapter = new LeverAdapter();

    console.log(`🚀 Navigating to Lever job: ${TARGET_JOB_URL}...`);
    await page.goto(TARGET_JOB_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);

    const isLever = await adapter.detect(page);
    console.log(`🎯 Lever Detection: ${isLever ? "✅ LEVER ATS CONFIRMED" : "❌ NOT RECOGNIZED"}`);

    // Extract job details
    const jobDetails = await adapter.extractJob(page);
    console.log(`📋 Job Details: Company="${jobDetails.company}", Title="${jobDetails.title}"`);

    // Extract fields
    const fields = await adapter.extractFields(page);
    console.log(`📊 Extracted ${fields.length} form fields from page.`);

    // 1. Upload Resume
    console.log("\n📄 [Phase 1]: Uploading resume PDF...");
    await adapter.uploadResume(page, RESUME_PATH, fields);

    // 2. Fill form using graphic zig-zag movements
    console.log("\n✍️ [Phase 2]: Filling Lever application with graphic zig-zag movements...");
    await adapter.fillForm(page, HRUTIN_PROFILE, {
      current_company: "Jobspring",
      twitter: "https://x.com/hrutin_dev",
      "salary": "$140,000 - $160,000 CAD",
      "aws": "Over 3+ years of building and deploying production cloud infrastructure using AWS services (EC2, S3, Lambda, API Gateway) and Azure App Service. Experienced in Docker containerization, cloud monitoring, microservices architecture, and automated CI/CD pipelines.",
      "staff": "Over several years of engineering end-to-end systems, I have led technical architectural decisions, designed resilient RAG and LLM ingestion pipelines, mentored engineering teams, and reduced production API response latencies by 30%. I focus on system reliability, scalable design, and high-impact business outcomes."
    }, fields);

    // 3. Pre-submit Validation Audit
    console.log("\n🔍 [Phase 3]: Auditing HTML5 form validity & required fields...");
    const isValid = await adapter.validate(page, fields);
    console.log(`Form Validity: ${isValid ? "✅ 100% VALID & COMPLETE" : "⚠️ WARNINGS DETECTED"}`);

    const preScreenshot = path.join(screenshotsDir, `lever-zigzag-filled-${Date.now()}.png`);
    await page.screenshot({ path: preScreenshot, fullPage: true });
    console.log(`📸 Pre-submit screenshot captured: ${preScreenshot}`);

    // 4. Submit application (Includes zig-zag review sweeps and graphic movement to submit button)
    console.log("\n🚀 [Phase 4]: Executing submission pipeline (Zig-Zag Review & Natural Click)...");
    const result = await adapter.submit(page);
    console.log("\n🏁 [Result]:", result);

    const postScreenshot = path.join(screenshotsDir, `lever-zigzag-result-${Date.now()}.png`);
    await page.screenshot({ path: postScreenshot, fullPage: true });
    console.log(`📸 Post-submit screenshot captured: ${postScreenshot}`);

  } catch (err: any) {
    console.error("❌ Test encountered an error:", err);
  } finally {
    console.log("🧹 Waiting 5 seconds before closing browser...");
    await page.waitForTimeout(5000);
    await context.close();
    await browser.close();
  }
}

runLeverTest().catch(console.error);
