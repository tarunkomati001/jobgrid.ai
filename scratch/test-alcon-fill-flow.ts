import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  console.log("Navigating to active Alcon job:", url);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    street: "1/908 aaradhya",
    addressLine2: "limda , wagodhiya",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390144",
    country: "India",
    willingToRelocate: true,
    workAuthorization: "Yes",
    yearsOfExperience: 2,
    gender: "Male",
    linkedinUrl: "https://www.linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    portfolioUrl: "https://github.com/hrutinnammi",
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const adapter = new WorkdayAdapter();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    console.log("Calling adapter.fillForm()...");
    await adapter.fillForm(page, profile, {
      resumePath: profile.resumePath!,
      "How did you hear about this opportunity?": "LinkedIn"
    });

    console.log("FillForm completed! Current URL:", page.url());
    await page.screenshot({ path: "scratch/alcon_fill_success.png", fullPage: true });

    const isValid = await adapter.validate(page);
    console.log("Validate result:", isValid);
  } catch (err: any) {
    console.error("Error during Alcon fillForm:", err.message);
    await page.screenshot({ path: "scratch/alcon_fill_error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
