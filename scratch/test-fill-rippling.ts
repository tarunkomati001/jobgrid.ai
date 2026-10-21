import { chromium } from "playwright";
import { RipplingAdapter } from "../src/ats/rippling/rippling.adapter";
import { UserProfile } from "../src/ats/ats.interface";

async function testFill() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const adapter = new RipplingAdapter();
  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "2025550198",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    country: "United States",
    street: "123 Market St",
    location: "San Francisco, CA",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    workAuthorization: "US Citizen / Permanent Resident",
    willingToRelocate: true,
    yearsOfExperience: 3,
    resumePath: "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf"
  };

  const url = "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.waitForTimeout(2000);

  console.log("Filling form...");
  await adapter.fillForm(page, profile, {});

  // Check validation
  const isValid = await adapter.validate(page);
  console.log("Form validated:", isValid);

  // Check required unfilled
  const unfilled = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input[aria-required='true'], [required]"));
    return inputs.map(i => ({
      name: (i as HTMLInputElement).name,
      testId: i.getAttribute("data-testid"),
      value: (i as HTMLInputElement).value
    })).filter(i => !i.value);
  });
  console.log("Unfilled required:", unfilled);

  await browser.close();
}

testFill().catch(console.error);
