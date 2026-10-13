import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
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

    console.log("1. Running uploadResume...");
    await adapter.uploadResume(page, resumePath, [], profile);

    console.log("Current page URL after upload:", page.url());

    // Advance through steps and inspect sections
    for (let s = 1; s <= 4; s++) {
      console.log(`\n--- Inspecting Step ${s} ---`);
      await page.waitForTimeout(3000);
      const headerText = await page.evaluate(() => {
        const h = document.querySelector("h2[data-automation-id='pageHeader'], h2, h1, [data-automation-id='progressBarActiveStep']");
        return h?.textContent?.trim() || "";
      });
      console.log("Header/Active step:", headerText);

      // Check for experience and education sections or buttons
      const sectionsInfo = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll("div[data-automation-id*='Section'], fieldset, [data-automation-id*='section']"));
        return sections.map(sec => ({
          automationId: sec.getAttribute("data-automation-id"),
          text: sec.textContent?.trim().slice(0, 150)
        }));
      });
      console.log("Sections info:", JSON.stringify(sectionsInfo.filter(x => x.automationId), null, 2));

      // Dump all buttons and inputs
      const elements = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("button, input, textarea, div[role='button'], div[role='combobox']"));
        return els.map(e => ({
          tag: e.tagName,
          id: e.id,
          autoId: e.getAttribute("data-automation-id"),
          aria: e.getAttribute("aria-label"),
          text: e.textContent?.trim().slice(0, 40),
          type: (e as HTMLInputElement).type,
          val: (e as HTMLInputElement).value
        })).filter(x => x.autoId || x.aria || (x.tag === 'BUTTON' && x.text));
      });
      console.log(`Elements on Step ${s}:`, JSON.stringify(elements, null, 2));

      await page.screenshot({ path: `scratch/workday_step_${s}_inspect.png`, fullPage: true });

      // Click next button
      const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button']").last();
      if (await nextBtn.count() > 0) {
        console.log("Clicking Next...");
        await (adapter as any).clickWorkdayButton(page, nextBtn);
        await page.waitForTimeout(6000);
      } else {
        console.log("No next button found, breaking.");
        break;
      }
    }
  } catch (err: any) {
    console.error("Error inspecting:", err.message);
  } finally {
    await browser.close();
  }
}

main();
