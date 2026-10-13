import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function testFullNavigation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  console.log(`Opening ${url}...`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // STEP 1: Fill Login
  console.log("Filling Step 1...");
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "u9m!LLvdS7Bcyqc");
  await page.fill("input[name='cwsPassword_2']", "u9m!LLvdS7Bcyqc");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  // STEP 2: Fill Personal Information
  console.log("Filling Step 2 with Hrutin Nammi's details...");
  await page.fill("input[name='firstName']", "Hrutin");
  await page.fill("input[name='lastName']", "Nammi");
  await page.fill("input[name='phone']", "8688423267");
  await page.fill("input[name='address']", "Vadodara");
  await page.fill("input[name='city']", "Vadodara");
  
  // State: California
  await page.selectOption("select[name='state']", "California");
  await page.fill("input[name='zipCode']", "94105");

  // Source: Careers Website (1)
  await page.selectOption("select[name='source']", "1");

  // Work Authorization (legalStatus): Authorized (441)
  await page.selectOption("select[name='legalStatus']", "441");

  // Are you a US Citizen (CUSTOM_1237): No (1388)
  await page.selectOption("select[name='CUSTOM_1237']", "1388");

  // Security Clearance (CUSTOM_1136): check 'None' (853) with force: true
  console.log("Checking Security Clearance (None)...");
  await page.evaluate(() => {
    const el = document.querySelector("input[name='CUSTOM_1136'][value='853']") as HTMLInputElement;
    if (el) {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      // Also update visual wrapper if any
      const parent = el.closest(".checkbox, .oracletaleocwsv2-custom-checkbox");
      if (parent) parent.classList.add("oracletaleocwsv2-checked");
    }
  });

  // Security Clearance Status (CUSTOM_1138): Not Applicable (1386)
  await page.selectOption("select[name='CUSTOM_1138']", "1386");

  // Security Clearance Notes: N/A
  await page.fill("textarea[name='CUSTOM_1140']", "N/A");

  // Highest Education Level (CUSTOM_288): Bachelor's Degree (478)
  await page.selectOption("select[name='CUSTOM_288']", "478");

  // Current Salary & Desired Salary
  await page.fill("input[name='CUSTOM_1238']", "75000");
  await page.fill("input[name='CUSTOM_1239']", "95000");

  await page.screenshot({ path: path.resolve(__dirname, "step2_filled.png") });

  // Click Next arrow to go to Step 3
  console.log("Clicking Next arrow from Step 2...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.resolve(__dirname, "step3_screen.png") });

  const activeStep2 = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text:not(:empty), .text-danger:not(:empty)")).map(e => e.textContent?.trim()).filter(Boolean);
    return {
      id: active ? active.id : null,
      title: active ? active.querySelector(".title")?.textContent?.trim() : null,
      errors
    };
  });
  console.log("Active step after Step 2 Next:", JSON.stringify(activeStep2, null, 2));

  // If on Step 3, let's inspect Step 3 details!
  if (activeStep2.id === "step-03") {
    console.log("🎉 Successfully moved to Step 3: Resume and Questions!");

    const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    console.log("Checking resume path:", resumePath, "exists:", fs.existsSync(resumePath));

    if (fs.existsSync(resumePath)) {
      // Find file input in step 3
      const resumeInput = page.locator("#resumeLocalFile, input[name='resume']").first();
      if (await resumeInput.count() > 0) {
        console.log("Setting input files for resume on #resumeLocalFile...");
        await resumeInput.setInputFiles(resumePath);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.resolve(__dirname, "step3_resume_uploaded.png") });
      }
    }

    // Also fill resume text or description if available
    const resumeText = page.locator("textarea[name='resumeText']");
    if (await resumeText.count() > 0) {
      await resumeText.fill("Hrutin Nammi - Full-Stack AI Developer (Vadodara, Gujarat)");
    }

    // Click Next from Step 3 to Step 4
    console.log("Clicking Next arrow from Step 3...");
    await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.resolve(__dirname, "step4_screen.png") });

    const activeStep3 = await page.evaluate(() => {
      const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
      const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text:not(:empty), .text-danger:not(:empty)")).map(e => e.textContent?.trim()).filter(Boolean);
      return {
        id: active ? active.id : null,
        title: active ? active.querySelector(".title")?.textContent?.trim() : null,
        errors
      };
    });
    console.log("Active step after Step 3 Next:", JSON.stringify(activeStep3, null, 2));

    if (activeStep3.id === "step-04") {
      console.log("🎉 Successfully moved to Step 4: Review and Submit!");

      // Fill e-signature and date
      console.log("Filling Step 4 e-signature...");
      const sigInput = page.locator("input[name='candESignature']");
      if (await sigInput.count() > 0) {
        await sigInput.fill("Hrutin Nammi");
      }
      const dateInput = page.locator("input[name='candEsignatureDate']");
      if (await dateInput.count() > 0) {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const yyyy = today.getFullYear();
        await dateInput.fill(`${mm}/${dd}/${yyyy}`);
      }

      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.resolve(__dirname, "step4_filled.png") });
      console.log("🎉 Step 4 successfully filled! Review & Submit is 100% complete!");
    }
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

testFullNavigation().catch(console.error);
