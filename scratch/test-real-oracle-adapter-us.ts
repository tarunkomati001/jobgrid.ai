import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const adapter = new OracleAdapter();

  const profile: UserProfile = {
    userId: "test_usr",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_us_${Date.now()}@gmail.com`,
    phone: "4155552671",
    country: "United States",
    street: "500 Oracle Parkway",
    addressLine2: "Suite 100",
    city: "Redwood City",
    state: "California",
    zipCode: "94065",
    location: "Redwood City, California, United States",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    gender: "Male",
    willingToRelocate: true,
    yearsOfExperience: 2,
    experiences: [],
    educations: [],
    skills: []
  };

  const testJobUrl = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
  console.log(`Navigating to ${testJobUrl}...`);
  await page.goto(testJobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  console.log("Calling OracleAdapter.fillForm...");
  await adapter.fillForm(page, profile);

  console.log("Checking Section 1 & Section 2 results...");
  const currentUrl = page.url();
  console.log("Current URL after fillForm:", currentUrl);

  const finalCheck = await page.evaluate(() => {
    return {
      country: (document.querySelector("input[name='country']") as any)?.value,
      phoneCountry: (document.getElementById("country-codes-dropdownphoneNumber") as any)?.value,
      phone: (document.querySelector("input.phone-row__input, input[type='tel']") as any)?.value,
      postalCode: (document.querySelector("input[name='postalCode']") as any)?.value,
      city: (document.querySelector("input[name='city']") as any)?.value,
      state: (document.querySelector("input[name='region2'], input[name='state']") as any)?.value
    };
  });
  console.log("Values check:", JSON.stringify(finalCheck, null, 2));

  await page.screenshot({ path: "scratch/oracle_real_adapter_us_test.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
