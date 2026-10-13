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

    // Run step 1 fill via adapter
    console.log("Filling Step 1...");
    // Let's use adapter.fillForm but stop right after step 1 advances!
    // We can monitor url or pageHeader
    let reachedExperience = false;

    // Listen to DOM changes
    for (let loop = 1; loop <= 5; loop++) {
      await page.waitForTimeout(2000);
      const isExp = await page.evaluate(() => {
        const body = document.body.innerText || "";
        return body.includes("Work Experience") || body.includes("My Experience");
      });

      const currentHeader = await page.evaluate(() => {
        const h = document.querySelector("h2[data-automation-id='pageHeader'], [data-automation-id='progressBarActiveStep']");
        return h?.textContent?.trim() || "";
      });

      console.log(`Loop ${loop}: Header="${currentHeader}", HasExperience=${isExp}`);

      if (isExp && (currentHeader.includes("Experience") || currentHeader.includes("My Experience"))) {
        console.log("🎯 SUCCESSFULLY REACHED MY EXPERIENCE STEP!");
        reachedExperience = true;
        break;
      }

      // Close drawer if open
      const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
      if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
        console.log("Closing open drawer...");
        await closeDrawer.click().catch(() => {});
        await page.waitForTimeout(500);
      }

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

      console.log("Clicking Next...");
      const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
      await (adapter as any).clickWorkdayButton(page, nextBtn);
      await page.waitForTimeout(6000);
    }

    if (reachedExperience) {
      await page.screenshot({ path: "scratch/step2_experience_screen.png", fullPage: true });

      // Save snippet of experience sections
      const expSnippet = await page.evaluate(() => {
        const secEls = Array.from(document.querySelectorAll("[data-automation-id*='Section'], [data-automation-id*='section'], fieldset, [data-automation-id*='panel']"));
        return secEls.map(el => ({
          autoId: el.getAttribute("data-automation-id"),
          tag: el.tagName,
          buttons: Array.from(el.querySelectorAll("button, [role='button']")).map(b => ({
            text: b.textContent?.trim(),
            autoId: b.getAttribute("data-automation-id"),
            aria: b.getAttribute("aria-label")
          })),
          inputs: Array.from(el.querySelectorAll("input, textarea, select")).map(i => ({
            autoId: i.getAttribute("data-automation-id"),
            id: i.id,
            placeholder: (i as HTMLInputElement).placeholder,
            aria: i.getAttribute("aria-label"),
            value: (i as HTMLInputElement).value
          }))
        }));
      });

      console.log("Experience DOM snippet:", JSON.stringify(expSnippet, null, 2));
      fs.writeFileSync("scratch/step2_experience_snippet.json", JSON.stringify(expSnippet, null, 2));
    }

  } catch (e: any) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

main();
