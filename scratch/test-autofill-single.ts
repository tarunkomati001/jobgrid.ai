import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";
import fs from "fs";

const profile: UserProfile = {
  userId: "usr_hrutin_nammi",
  firstName: "Hrutin",
  lastName: "Nammi",
  email: "babufakemail@gmail.com",
  phone: "8688423267",
  location: "Vadodara, Gujarat, India",
  linkedinUrl: "https://linkedin.com/in/hrutinnammi",
  githubUrl: "https://github.com/hrutinnammi",
  portfolioUrl: "https://github.com/hrutinnammi",
  workAuthorization: "Authorized to Work",
  willingToRelocate: true,
  yearsOfExperience: 2
};

const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  const adapter = new TaleoAdapter();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720";
  console.log(`Starting test autofill for: ${url}`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // Take screenshot of requisition
  await page.screenshot({ path: "scratch/step0_requisition_4720.png" });

  // Run fillForm
  await adapter.fillForm(page, profile, {
    password: process.env.TALEO_PASSWORD || "Tarun@2006"
  });

  // Upload Resume if not uploaded
  if (fs.existsSync(resumePath)) {
    await adapter.uploadResume(page, resumePath);
  }

  await page.screenshot({ path: "scratch/step_final_4720.png", fullPage: true });

  const isValid = await adapter.validate(page);
  console.log(`Validation passed: ${isValid}`);

  const pageErrors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text, .text-danger, .has-error"))
      .map(el => el.textContent?.trim())
      .filter(Boolean);
  });
  console.log("Page errors (if any):", pageErrors);

  const activeStep = await page.evaluate(() => {
    const el = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    return el ? { id: el.id, htmlSnippet: el.innerHTML.slice(0, 500) } : null;
  });
  console.log("Active step:", activeStep?.id);

  await browser.close();
}

main().catch(console.error);
