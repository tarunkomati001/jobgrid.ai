import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function inspectStep3() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 850 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();
  const adapter = new WorkdayAdapter();

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Kumar",
    email: "babufakemail@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    willingToRelocate: true,
    workAuthorization: "Yes",
    yearsOfExperience: 3
  };
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  try {
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    await adapter.uploadResume(page, resumePath, [], profile);

    // Let fillForm advance through steps 1 and 2
    // On step 3, let's inspect the dropdown elements
    for (let step = 1; step <= 3; step++) {
      console.log(`Step ${step}...`);
      if (step === 3) {
        // Inspect all dropdown buttons
        const dropdownInfo = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button, div[role='button'], div[role='combobox'], [data-automation-id*='select']"));
          return buttons.map(b => ({
            tag: b.tagName,
            id: b.id,
            automationId: b.getAttribute("data-automation-id"),
            role: b.getAttribute("role"),
            haspopup: b.getAttribute("aria-haspopup"),
            text: b.textContent?.trim().slice(0, 50),
            parentText: b.closest("div[data-automation-id*='formField'], [data-automation-id*='question'], div")?.textContent?.trim().slice(0, 100)
          })).filter(x => x.text?.includes("Select One") || x.haspopup === "listbox" || x.automationId?.includes("select") || x.automationId?.includes("dropdown"));
        });
        console.log("Dropdown elements found on Step 3:", JSON.stringify(dropdownInfo, null, 2));

        // Click the first dropdown to inspect listbox options
        const firstBtn = page.locator("button:has-text('Select One'), div[role='button']:has-text('Select One')").first();
        if (await firstBtn.count() > 0) {
          console.log("Clicking first Select One button...");
          await firstBtn.click();
          await page.waitForTimeout(1000);
          const options = await page.evaluate(() => {
            const opts = Array.from(document.querySelectorAll("li, [role='option'], div[id*='promptOption']"));
            return opts.map(o => ({
              tag: o.tagName,
              id: o.id,
              role: o.getAttribute("role"),
              text: o.textContent?.trim()
            })).slice(0, 10);
          });
          console.log("Options opened:", JSON.stringify(options, null, 2));
        }
        break;
      }
      // advance step 1 and 2
      await (adapter as any).fillSourceDropdown(page);
      await (adapter as any).fillPersonalInfoFields(page, profile);
      await (adapter as any).fillAddressAndContact(page, profile);
      await (adapter as any).fillRadioQuestions(page, profile);
      await (adapter as any).fillCheckboxes(page);
      await (adapter as any).fillRequiredInputs(page, profile);
      const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
      await (adapter as any).clickWorkdayButton(page, nextBtn);
      await page.waitForTimeout(8000);
    }
  } catch (err: any) {
    console.error("Inspect error:", err.message);
  } finally {
    await browser.close();
  }
}

inspectStep3();
