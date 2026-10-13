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

    // Override or hook into page navigations
    // Let's run fillForm but stop on step 2
    // We can observe the activeStep in page
    let stepCount = 0;
    while (stepCount < 4) {
      stepCount++;
      const activeStep = await page.evaluate(() => {
        const h = document.querySelector("[data-automation-id='progressBarActiveStep'], h2[data-automation-id='pageHeader'], h2");
        return h?.textContent?.trim() || "";
      });
      console.log(`Current Step ${stepCount}: "${activeStep}"`);

      if (activeStep.toLowerCase().includes("experience")) {
        console.log("🎯 REACHED EXPERIENCE STEP! Dumping DOM details...");
        await page.screenshot({ path: "scratch/step2_experience_full.png", fullPage: true });

        const data = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
            tag: b.tagName,
            text: b.textContent?.trim(),
            autoId: b.getAttribute("data-automation-id"),
            aria: b.getAttribute("aria-label"),
            parentSec: b.closest("[data-automation-id*='Section'], [data-automation-id*='section'], section, fieldset")?.getAttribute("data-automation-id")
          }));

          const inputs = Array.from(document.querySelectorAll("input, textarea, select")).map(i => ({
            tag: i.tagName,
            autoId: i.getAttribute("data-automation-id"),
            id: i.id,
            aria: i.getAttribute("aria-label"),
            parentSec: i.closest("[data-automation-id*='Section'], [data-automation-id*='section'], section, fieldset")?.getAttribute("data-automation-id")
          }));

          const sections = Array.from(document.querySelectorAll("[data-automation-id*='Section'], [data-automation-id*='section'], [data-automation-id*='panel'], h3, h4")).map(s => ({
            tag: s.tagName,
            autoId: s.getAttribute("data-automation-id"),
            text: s.textContent?.trim()?.slice(0, 100)
          }));

          return { buttons, inputs, sections };
        });

        console.log("Buttons found:", JSON.stringify(data.buttons, null, 2));
        console.log("Inputs found:", JSON.stringify(data.inputs, null, 2));
        console.log("Sections found:", JSON.stringify(data.sections, null, 2));
        fs.writeFileSync("scratch/experience_dom.json", JSON.stringify(data, null, 2));
        break;
      }

      // Close drawer if open
      const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
      if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
        await closeDrawer.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // Fill current step standard fields
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
      await (adapter as any).remedyWorkdayErrorsAndAlerts(page, profile);

      const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
      await (adapter as any).clickWorkdayButton(page, nextBtn);
      await page.waitForTimeout(6000);
      await (adapter as any).remedyWorkdayErrorsAndAlerts(page, profile);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
