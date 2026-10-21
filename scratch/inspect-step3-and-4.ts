import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function inspectStep3And4() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742", { waitUntil: "networkidle" });

  // Step 1
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "u9m!LLvdS7Bcyqc");
  await page.fill("input[name='cwsPassword_2']", "u9m!LLvdS7Bcyqc");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(2000);

  // Step 2
  await page.fill("input[name='firstName']", "Hrutin");
  await page.fill("input[name='lastName']", "Nammi");
  await page.fill("input[name='phone']", "8688423267");
  await page.fill("input[name='address']", "Vadodara");
  await page.fill("input[name='city']", "Vadodara");
  await page.selectOption("select[name='state']", "California");
  await page.fill("input[name='zipCode']", "94105");
  await page.selectOption("select[name='source']", "1");
  await page.selectOption("select[name='legalStatus']", "441");
  await page.selectOption("select[name='CUSTOM_1237']", "1388");

  // Popup for Security Clearance
  const popupBtn = page.locator("button[aria-label='Security Clearance']").first();
  await popupBtn.click();
  await page.waitForTimeout(500);
  const noneOpt = page.locator(".oracletaleocwsv2-multiselect-popup label:has-text('None')").first();
  await noneOpt.click();
  await page.waitForTimeout(300);
  const saveBtn = page.locator(".oracletaleocwsv2-multiselect-popup a.oracletaleocwsv2-close-popup-trigger:has-text('Save')").first();
  await saveBtn.click();
  await page.waitForTimeout(500);

  await page.selectOption("select[name='CUSTOM_1138']", "1386");
  await page.fill("textarea[name='CUSTOM_1140']", "N/A");
  await page.selectOption("select[name='CUSTOM_288']", "478");
  await page.fill("input[name='CUSTOM_1238']", "75000");
  await page.fill("input[name='CUSTOM_1239']", "95000");

  // Click Next to Step 3
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(2000);

  // Step 3 inspection
  const step3Details = await page.evaluate(() => {
    const s3 = document.getElementById("step-03");
    if (!s3) return null;
    const elements = Array.from(s3.querySelectorAll("input, select, textarea, button, a")).map(el => ({
      tag: el.tagName,
      type: (el as any).type,
      id: el.id,
      name: (el as any).name,
      text: el.textContent?.trim().slice(0, 50),
      className: el.className
    }));
    return {
      title: s3.querySelector(".title")?.textContent?.trim(),
      elements
    };
  });

  console.log("Step 3 Details:", JSON.stringify(step3Details, null, 2));

  // Upload Resume on Step 3
  const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Resume path:", resumePath, "exists:", fs.existsSync(resumePath));

  // Find all file inputs
  const fileInputs = await page.locator("input[type='file']").all();
  console.log(`Found ${fileInputs.length} file inputs.`);

  for (let i = 0; i < fileInputs.length; i++) {
    const name = await fileInputs[i].getAttribute("name");
    const id = await fileInputs[i].getAttribute("id");
    console.log(`File input ${i}: name='${name}' id='${id}'`);
  }

  // Look for #resumeLocalFile or input[name='resume']
  const rInput = page.locator("#resumeLocalFile, input[name='resume']").first();
  if (await rInput.count() > 0) {
    console.log("Setting input files for #resumeLocalFile...");
    await rInput.setInputFiles(resumePath);
    await page.waitForTimeout(2000);
  }

  // Also paste resume text in textarea[name='resumeText'] if present
  const rTextArea = page.locator("textarea[name='resumeText']").first();
  if (await rTextArea.count() > 0) {
    console.log("Filling resume text area...");
    await rTextArea.fill(`HRUTIN NAMMI
Full-Stack AI Developer | babufakemail@gmail.com | +91 86884 23267 | Vadodara, Gujarat, India
LinkedIn: https://linkedin.com/in/hrutinnammi | GitHub: https://github.com/hrutinnammi

SUMMARY:
Results-driven Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces.`);
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: path.resolve(__dirname, "step3_filled.png") });

  // Click Next arrow to Step 4
  console.log("Clicking Next from Step 3 to Step 4...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

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
    console.log("🎉 Reached Step 4: Review and Submit!");
    await page.screenshot({ path: path.resolve(__dirname, "step4_reached.png") });

    // Fill Step 4 signature and date
    console.log("Filling Step 4 signature and date...");
    await page.fill("input[name='candESignature']", "Hrutin Nammi");

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${mm}/${dd}/${yyyy}`;
    await page.fill("input[name='candEsignatureDate']", dateStr);

    await page.screenshot({ path: path.resolve(__dirname, "step4_fully_filled.png") });
    console.log("🎉 Application is 100% filled across ALL steps!");
  }

  await page.waitForTimeout(3000);
  await browser.close();
}

inspectStep3And4().catch(console.error);
