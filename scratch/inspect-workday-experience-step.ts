import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";
import * as fs from "fs";

async function inspectExperienceStep() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1";
  console.log("Navigating to test job:", testUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();
  const adapter = new WorkdayAdapter();

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    street: "1/908 aaradhya",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390001",
    country: "India",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    portfolioUrl: "https://github.com/hrutinnammi",
    willingToRelocate: true,
    workAuthorization: "Yes",
    yearsOfExperience: 2,
    gender: "Male"
  };

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  try {
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    console.log("Uploading resume & authenticating...");
    await adapter.uploadResume(page, resumePath, [], profile);

    // Let's advance past Step 1 (My Information)
    console.log("Filling Step 1 (My Information)...");
    await (adapter as any).fillSourceDropdown(page);
    await (adapter as any).fillPreviouslyWorkedQuestion(page);
    await (adapter as any).fillPersonalInfoFields(page, profile);
    await (adapter as any).formatNamesToTitleCase(page, profile);
    await (adapter as any).fillAddressAndContact(page, profile);
    await (adapter as any).cleanAndFillPhoneNumber(page, profile);
    await (adapter as any).fillRadioQuestions(page, profile);
    await (adapter as any).fillCheckboxes(page);
    await (adapter as any).fillRequiredInputs(page, profile);

    // Click Next to reach Step 2 (My Experience)
    console.log("Clicking Next from Step 1...");
    const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
    await (adapter as any).clickWorkdayButton(page, nextBtn);
    await page.waitForTimeout(6000);

    // Auto-remedy if alerts
    await (adapter as any).remedyWorkdayErrorsAndAlerts(page, profile);
    if (await page.locator("button[data-automation-id='bottom-navigation-next-button']").count() > 0) {
      const activeStep = await page.evaluate(() => document.querySelector("[data-automation-id='progressBarActiveStep'], h2")?.textContent?.trim() || "");
      console.log("Current active step after clicking Next:", activeStep);
      if (activeStep.toLowerCase().includes("information")) {
        console.log("Still on Information step, retrying Next...");
        await (adapter as any).clickWorkdayButton(page, nextBtn);
        await page.waitForTimeout(6000);
      }
    }

    console.log("--- NOW ON STEP 2 (MY EXPERIENCE) ---");
    await page.screenshot({ path: "scratch/step2_experience_screen.png", fullPage: true });

    // Inspect the full DOM of Step 2
    const step2Html = await page.content();
    fs.writeFileSync("scratch/step2_experience_dom.html", step2Html);

    // Dump all buttons, headings, sections, inputs on Step 2
    const analysis = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
        tag: b.tagName,
        autoId: b.getAttribute("data-automation-id"),
        id: b.id,
        ariaLabel: b.getAttribute("aria-label"),
        text: b.textContent?.trim()
      }));

      const allInputs = Array.from(document.querySelectorAll("input, textarea, select")).map(i => ({
        tag: i.tagName,
        autoId: i.getAttribute("data-automation-id"),
        id: i.id,
        name: (i as HTMLInputElement).name,
        type: (i as HTMLInputElement).type,
        ariaLabel: i.getAttribute("aria-label"),
        placeholder: (i as HTMLInputElement).placeholder,
        value: (i as HTMLInputElement).value
      }));

      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, [data-automation-id*='Section'], [data-automation-id*='section']")).map(h => ({
        tag: h.tagName,
        autoId: h.getAttribute("data-automation-id"),
        text: h.textContent?.trim()?.slice(0, 80)
      }));

      return { allButtons, allInputs, headings };
    });

    console.log("Headings / Sections on Step 2:", JSON.stringify(analysis.headings, null, 2));
    console.log("Buttons on Step 2:", JSON.stringify(analysis.allButtons, null, 2));
    console.log("Inputs on Step 2:", JSON.stringify(analysis.allInputs, null, 2));

  } catch (err: any) {
    console.error("Error in inspectExperienceStep:", err.message);
  } finally {
    await browser.close();
  }
}

inspectExperienceStep();
