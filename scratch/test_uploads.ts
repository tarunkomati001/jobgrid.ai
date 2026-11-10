import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import path from "path";
import fs from "fs";

async function testUploads() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });
  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);

  // Step 1
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006!Secure");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006!Secure");
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(3000);

  // Import adapter
  const { TaleoAdapter } = await import("../src/ats/taleo/taleo.adapter");
  const adapter = new TaleoAdapter();

  // Test Step 2 with Available Start Date
  console.log("Filling Step 2...");
  // Fill all fields
  await (adapter as any).handleTbeWorkflow(page, {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "4155552671",
    street: "500 Oracle Parkway",
    addressLine2: "Suite 100",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    country: "United States"
  }, "babufakemail@gmail.com", "Tarun@2006!Secure");

  // Let's navigate to Step 3 (Resume and Questions)
  console.log("Navigating back to Step 3 to test resume and cover letter...");
  while (true) {
    const title = await page.title();
    if (title.toLowerCase().includes("resume")) break;
    const prevBtn = page.locator(".oracletaleocwsv2-arrow-nav-prev:visible").first();
    if (await prevBtn.count() === 0) break;
    await prevBtn.click();
    await page.waitForTimeout(2000);
  }

  const resumePdf = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const coverPdf = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf");

  console.log("Testing Resume Upload on Step 3...");
  const addResumeBtn = page.locator("a.oracletaleocwsv2-add-resume-trigger:visible, button:has-text('Add Resume')").first();
  if (await addResumeBtn.count() > 0 && await addResumeBtn.isVisible().catch(() => false)) {
    console.log("Clicking 'Add Resume' button...");
    await addResumeBtn.click();
    await page.waitForTimeout(1000);
  }

  // Look for file input for resume
  const resumeFileInput = page.locator("input[type='file']#resumeLocalFile, input[type='file'][name='resume']").first();
  if (await resumeFileInput.count() > 0) {
    console.log("Setting input files for resume...");
    await resumeFileInput.setInputFiles(resumePdf);
    await page.waitForTimeout(1000);
    // Find save button inside resume section
    const saveResumeBtn = page.locator(".oracletaleocwsv2-save-edit-trigger:visible").first();
    if (await saveResumeBtn.count() > 0 && await saveResumeBtn.isVisible().catch(() => false)) {
      console.log("Clicking Save Resume button...");
      await saveResumeBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  console.log("Testing Cover Letter Textarea on Step 3...");
  const coverText = `Dear Hiring Team,\n\nI am writing to express my enthusiastic interest in this position. As a Full Stack AI Developer with a solid background in building autonomous agent pipelines, resilient enterprise web architectures, and seamless cloud deployments, I bring hands-on experience in modern full-stack development, Python, TypeScript, and distributed systems.\n\nI am excited about the opportunity to contribute high impact and dedicated problem-solving to your organization.\n\nSincerely,\nHrutin Nammi`;
  const resumeTextarea = page.locator("textarea[name='resumeText'], textarea#resumeText__id_txt_").first();
  if (await resumeTextarea.count() > 0) {
    console.log("Filling resumeText / Cover Letter textarea...");
    await resumeTextarea.fill(coverText);
    await page.waitForTimeout(1000);
  }

  console.log("Testing Cover Letter Attachment on Step 3...");
  const addAttBtn = page.locator("a.oracletaleocwsv2-add-attachment-trigger:visible, button:has-text('Add Attachment')").first();
  if (await addAttBtn.count() > 0 && await addAttBtn.isVisible().catch(() => false)) {
    console.log("Clicking 'Add Attachment' button...");
    await addAttBtn.click();
    await page.waitForTimeout(1000);

    const attFileInput = page.locator("input[type='file'][name*='attachment' i], input[type='file']#attachmentLocalFile, input[type='file']").last();
    if (await attFileInput.count() > 0) {
      console.log("Setting input files for attachment...");
      await attFileInput.setInputFiles(coverPdf).catch(console.error);
      await page.waitForTimeout(1000);

      const descInp = page.locator("input[name='description']#description, input[name='description']:visible").first();
      if (await descInp.count() > 0) {
        await descInp.fill("Cover Letter");
      }

      const saveAttBtn = page.locator(".oracletaleocwsv2-save-edit-trigger:visible").last();
      if (await saveAttBtn.count() > 0 && await saveAttBtn.isVisible().catch(() => false)) {
        console.log("Clicking Save Attachment button...");
        await saveAttBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  }

  await page.screenshot({ path: "scratch/step3_after_fill.png", fullPage: true });
  console.log("Saved screenshot to scratch/step3_after_fill.png");
  await browser.close();
}

testUploads().catch(console.error);

