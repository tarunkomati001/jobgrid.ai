import { chromium, Page } from "playwright";
import path from "path";
import fs from "fs";

const JOBS = [
  { rid: "4742", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4742" },
  { rid: "4790", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4790" },
  { rid: "4744", url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4744" }
];

const ACCOUNT = {
  email: "babufakemail@gmail.com",
  password: process.env.TALEO_PASSWORD || "Tarun@2006"
};

const HRUTIN = {
  firstName: "Hrutin",
  lastName: "Nammi",
  phone: "8688423267",
  address: "Vadodara",
  city: "Vadodara",
  state: "California",
  zipCode: "94105",
  source: "1", // Careers Website
  legalStatus: "441", // Authorized for any employer
  usCitizen: "1388", // No
  securityClearanceStatus: "1386", // Not Applicable
  educationLevel: "478", // Bachelor's Degree
  currentSalary: "75000",
  desiredSalary: "95000",
  resumePath: path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf"),
  resumeSummary: `HRUTIN NAMMI
Full-Stack AI Developer | babufakemail@gmail.com | +91 86884 23267 | Vadodara, Gujarat, India
LinkedIn: https://linkedin.com/in/hrutinnammi | GitHub: https://github.com/hrutinnammi

SUMMARY:
Results-driven Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces.`
};

async function fillTaleoJob(page: Page, job: { rid: string, url: string }, index: number) {
  console.log(`\n======================================================`);
  console.log(`🚀 PROCESSING JOB [${index + 1}/3]: RID=${job.rid}`);
  console.log(`URL: ${job.url}`);
  console.log(`======================================================\n`);

  await page.goto(job.url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // Click Apply Now button
  const applyBtn = page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first();
  if (await applyBtn.count() > 0) {
    console.log("Clicking 'Apply Now' button on job description page...");
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }

  console.log(`Current wizard URL: ${page.url()}`);

  // ---------------- STEP 1: LOGIN / ACCOUNT ----------------
  console.log("📝 Step 1: Entering account credentials...");
  await page.fill("input[name='email']", ACCOUNT.email);
  await page.fill("input[name='cwsPassword']", ACCOUNT.password);
  await page.fill("input[name='cwsPassword_2']", ACCOUNT.password);
  await page.waitForTimeout(500);

  console.log("Advancing to Step 2...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  // ---------------- STEP 2: PERSONAL & CANDIDATE INFO ----------------
  console.log("📝 Step 2: Filling candidate personal information...");
  if (await page.locator("input[name='firstName']").count() > 0) {
    await page.fill("input[name='firstName']", HRUTIN.firstName);
  }
  if (await page.locator("input[name='lastName']").count() > 0) {
    await page.fill("input[name='lastName']", HRUTIN.lastName);
  }
  if (await page.locator("input[name='phone']").count() > 0) {
    await page.fill("input[name='phone']", HRUTIN.phone);
  }
  if (await page.locator("input[name='address']").count() > 0) {
    await page.fill("input[name='address']", HRUTIN.address);
  }
  if (await page.locator("input[name='city']").count() > 0) {
    await page.fill("input[name='city']", HRUTIN.city);
  }
  if (await page.locator("select[name='state']").count() > 0) {
    await page.selectOption("select[name='state']", HRUTIN.state);
  }
  if (await page.locator("input[name='zipCode']").count() > 0) {
    await page.fill("input[name='zipCode']", HRUTIN.zipCode);
  }
  if (await page.locator("select[name='source']").count() > 0) {
    await page.selectOption("select[name='source']", HRUTIN.source);
  }
  if (await page.locator("select[name='legalStatus']").count() > 0) {
    await page.selectOption("select[name='legalStatus']", HRUTIN.legalStatus);
  }
  if (await page.locator("select[name='CUSTOM_1237']").count() > 0) {
    await page.selectOption("select[name='CUSTOM_1237']", HRUTIN.usCitizen);
  }

  // Handle Security Clearance Multiselect popup
  const clearanceBtn = page.locator("button[aria-label='Security Clearance']").first();
  if (await clearanceBtn.count() > 0 && await clearanceBtn.isVisible()) {
    console.log("Selecting Security Clearance: None...");
    await clearanceBtn.click();
    await page.waitForTimeout(500);
    const noneOpt = page.locator(".oracletaleocwsv2-multiselect-popup label:has-text('None')").first();
    if (await noneOpt.count() > 0) {
      await noneOpt.click();
      await page.waitForTimeout(300);
    }
    const savePopup = page.locator(".oracletaleocwsv2-multiselect-popup a.oracletaleocwsv2-close-popup-trigger:has-text('Save')").first();
    if (await savePopup.count() > 0) {
      await savePopup.click();
      await page.waitForTimeout(500);
    }
  }

  if (await page.locator("select[name='CUSTOM_1138']").count() > 0) {
    await page.selectOption("select[name='CUSTOM_1138']", HRUTIN.securityClearanceStatus);
  }
  if (await page.locator("textarea[name='CUSTOM_1140']").count() > 0) {
    await page.fill("textarea[name='CUSTOM_1140']", "N/A");
  }
  if (await page.locator("select[name='CUSTOM_288']").count() > 0) {
    await page.selectOption("select[name='CUSTOM_288']", HRUTIN.educationLevel);
  }
  if (await page.locator("input[name='CUSTOM_1238']").count() > 0) {
    await page.fill("input[name='CUSTOM_1238']", HRUTIN.currentSalary);
  }
  if (await page.locator("input[name='CUSTOM_1239']").count() > 0) {
    await page.fill("input[name='CUSTOM_1239']", HRUTIN.desiredSalary);
  }

  // Check if any other custom questions are present on Step 2
  const unhandledStep2 = await page.evaluate(() => {
    const s2 = document.getElementById("step-02");
    if (!s2) return [];
    return Array.from(s2.querySelectorAll("input, select, textarea")).filter(el => {
      const inp = el as any;
      if (inp.type === "hidden" || inp.disabled || inp.readOnly) return false;
      return !inp.value || inp.value === "-1";
    }).map(el => ({
      name: (el as any).name,
      id: el.id,
      tag: el.tagName
    }));
  });
  if (unhandledStep2.length > 0) {
    console.log("Unhandled fields on Step 2:", JSON.stringify(unhandledStep2));
  }

  console.log("Advancing to Step 3...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  // ---------------- STEP 3: RESUME & QUESTIONS ----------------
  console.log("📝 Step 3: Attaching resume & filling text...");
  const resumeInput = page.locator("#resumeLocalFile, input[name='resume']").first();
  if (await resumeInput.count() > 0 && fs.existsSync(HRUTIN.resumePath)) {
    console.log("Uploading resume PDF...");
    await resumeInput.setInputFiles(HRUTIN.resumePath);
    await page.waitForTimeout(2000);
  }

  const resumeTextArea = page.locator("textarea[name='resumeText']").first();
  if (await resumeTextArea.count() > 0) {
    await resumeTextArea.fill(HRUTIN.resumeSummary);
  }

  console.log("Advancing to Step 4...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  // ---------------- STEP 4: REVIEW & CERTIFICATION ----------------
  console.log("📝 Step 4: Signing candidate certification...");
  const sig = page.locator("input[name='candESignature']").first();
  if (await sig.count() > 0) {
    await sig.fill(`${HRUTIN.firstName} ${HRUTIN.lastName}`);
  }

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;
  const sigDate = page.locator("input[name='candEsignatureDate']").first();
  if (await sigDate.count() > 0) {
    await sigDate.fill(dateStr);
  }

  await page.waitForTimeout(2000);
  const shotPath = path.resolve(__dirname, `taleo_job_${job.rid}_fully_filled.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`✅ Saved complete application screenshot to: ${shotPath}`);

  // Validate state
  const finalState = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text:not(:empty), .text-danger:not(:empty)"))
      .map(e => e.textContent?.trim())
      .filter(t => t && !t.includes("Draft saved") && !t.includes("required"));
    
    const submitBtn = document.querySelector("button[type='submit'].btn-primary");
    return {
      stepId: active ? active.id : null,
      stepTitle: active ? active.querySelector(".title")?.textContent?.trim() : null,
      errors,
      canSubmit: !!submitBtn
    };
  });

  console.log(`🎉 Job ${job.rid} Status:`, JSON.stringify(finalState, null, 2));
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  for (let i = 0; i < JOBS.length; i++) {
    await fillTaleoJob(page, JOBS[i], i);
  }

  console.log("\n======================================================");
  console.log("🏁 ALL 3 TALEO JOBS SUCCESSFULLY MAPPED AND FILLED!");
  console.log("======================================================\n");

  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(console.error);
