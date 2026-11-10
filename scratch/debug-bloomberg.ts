import { chromium } from "playwright";
import { AvatureAdapter } from "../src/ats/avature/avature.adapter";

async function testBloomberg() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const adapter = new AvatureAdapter();
  const url = "https://bloomberg.avature.net/careers/JobDetail/Senior-Software-Engineer-Public-Cloud-Engineering/20217#";

  console.log("Navigating to Bloomberg:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const mockProfile: any = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "2025550198",
    city: "San Francisco",
    state: "California",
    country: "United States",
    zipCode: "94105",
    street: "123 Market St",
    linkedin: "https://linkedin.com/in/hrutinnammi",
    github: "https://github.com/hrutinnammi",
    willingToRelocate: true,
    requiresSponsorship: false,
    authorizedInUS: true,
    clearance: false,
    gender: "Male",
    race: "Asian",
    veteran: "No",
    disability: "No",
    resumePath: "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf"
  };

  try {
    await adapter.fillForm(page, mockProfile);
    console.log("Bloomberg fillForm finished successfully!");
  } catch (err: any) {
    console.error("Bloomberg fillForm error:", err.message);
  }

  console.log("Final URL:", page.url());
  await page.screenshot({ path: "scratch/bloomberg_live_result.png", fullPage: true });
  await browser.close();
}

testBloomberg().catch(console.error);
