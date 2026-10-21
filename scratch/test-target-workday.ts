import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  const targetUrl = "https://target.wd5.myworkdayjobs.com/en-US/targetcareers/job/1000-Nicollet-Mall-MinneapolisMN-55403-2542/Sr-Data-Analyst_R0000437844/apply/autofillWithResume";
  console.log("Navigating to Target job:", targetUrl);

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
    email: `babufakemail+target${Date.now()}@gmail.com`,
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    street: "1/908 aaradhya",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390001",
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

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    console.log("Current URL:", page.url());
    await page.screenshot({ path: "scratch/target_initial.png", fullPage: true });

    console.log("Calling adapter.fillForm()...");
    await adapter.fillForm(page, profile, { resumePath: profile.resumePath! });

    await page.screenshot({ path: "scratch/target_after_fillform.png", fullPage: true });

    const isValid = await adapter.validate(page);
    console.log("Validate result:", isValid);

    const sub = await adapter.submit(page);
    console.log("Submit result:", JSON.stringify(sub, null, 2));

  } catch (err: any) {
    console.error("Error in Target test:", err.message);
    await page.screenshot({ path: "scratch/target_error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
