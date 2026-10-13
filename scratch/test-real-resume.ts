import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testRealResume() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Uploading real resume:", realResumePath);

  const fileInput = page.locator("input[type='file']").first();
  await fileInput.setInputFiles(realResumePath);

  console.log("Waiting for resume parsing...");
  await page.waitForTimeout(6000);

  // Check what was prefilled
  const prefilled = await page.evaluate(`(() => {
    const fn = document.querySelector("#first-name-input")?.value;
    const ln = document.querySelector("#last-name-input")?.value;
    const em = document.querySelector("#email-input")?.value;
    const ph = document.querySelector("spl-phone-field input[type='tel']")?.value;
    const experiences = Array.from(document.querySelectorAll("oc-experience-entry")).map(e => e.innerText?.trim());
    return { fn, ln, em, ph, experiencesCount: experiences.length, experiences };
  })()`);

  console.log("Prefilled data:", JSON.stringify(prefilled, null, 2));

  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, "real_resume_parsed.png"), fullPage: true });

  await browser.close();
}

testRealResume().catch(console.error);
