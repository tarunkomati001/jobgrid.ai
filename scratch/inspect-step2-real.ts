import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";
import * as fs from "fs";

async function main() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1";
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
    await adapter.uploadResume(page, resumePath, [], profile);

    console.log("Uploaded resume! Current URL:", page.url());

    // Step 1: Fill My Information
    console.log("Filling My Information...");
    await (adapter as any).fillSourceDropdown(page);
    await (adapter as any).fillPreviouslyWorkedQuestion(page);
    await (adapter as any).fillPersonalInfoFields(page, profile);
    await (adapter as any).formatNamesToTitleCase(page, profile);
    await (adapter as any).fillAddressAndContact(page, profile);
    await (adapter as any).cleanAndFillPhoneNumber(page, profile);
    await (adapter as any).fillRadioQuestions(page, profile);
    await (adapter as any).fillCheckboxes(page);
    await (adapter as any).fillWorkdayDateInputs(page);
    await (adapter as any).fillRequiredInputs(page, profile);

    // Advance to Step 2 (My Experience)
    console.log("Advancing past My Information...");
    const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
    await (adapter as any).clickWorkdayButton(page, nextBtn);
    await page.waitForTimeout(6000);

    // Auto-remedy alerts if any and re-click
    await (adapter as any).remedyWorkdayErrorsAndAlerts(page, profile);
    await page.waitForTimeout(1000);
    const retryNext = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
    if (await retryNext.count() > 0 && await retryNext.isVisible().catch(() => false)) {
      await (adapter as any).clickWorkdayButton(page, retryNext);
      await page.waitForTimeout(6000);
    }

    console.log("Current URL on Step 2:", page.url());
    await page.screenshot({ path: "scratch/step2_experience_screen.png", fullPage: true });

    // Inspect all buttons, sections, inputs on Step 2
    const data = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim(),
        autoId: b.getAttribute("data-automation-id"),
        id: b.id,
        aria: b.getAttribute("aria-label"),
        parent: b.closest("[data-automation-id*='Section'], [data-automation-id*='section'], section, fieldset")?.getAttribute("data-automation-id")
      }));

      const inputs = Array.from(document.querySelectorAll("input, textarea, select")).map(i => ({
        tag: i.tagName,
        autoId: i.getAttribute("data-automation-id"),
        id: i.id,
        placeholder: (i as HTMLInputElement).placeholder,
        aria: i.getAttribute("aria-label"),
        parent: i.closest("[data-automation-id*='Section'], [data-automation-id*='section'], section, fieldset")?.getAttribute("data-automation-id")
      }));

      const sections = Array.from(document.querySelectorAll("[data-automation-id*='Section'], [data-automation-id*='section'], h2, h3, h4")).map(s => ({
        tag: s.tagName,
        autoId: s.getAttribute("data-automation-id"),
        text: s.textContent?.trim()?.slice(0, 80)
      }));

      return { buttons, inputs, sections };
    });

    console.log("Sections on Step 2:", JSON.stringify(data.sections, null, 2));
    console.log("Buttons on Step 2:", JSON.stringify(data.buttons, null, 2));
    console.log("Inputs on Step 2:", JSON.stringify(data.inputs, null, 2));
    fs.writeFileSync("scratch/step2_dom.json", JSON.stringify(data, null, 2));

  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
