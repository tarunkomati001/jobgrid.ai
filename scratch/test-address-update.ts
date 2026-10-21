import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_addr_${Date.now()}@gmail.com`,
    phone: "8688423267",
    location: "1/908 aaradhya, limda , wagodhiya, Vadodara, Gujarat, 390144, India",
    street: "1/908 aaradhya",
    addressLine2: "limda , wagodhiya",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390144",
    country: "India",
    willingToRelocate: true,
    yearsOfExperience: 2,
    gender: "Male"
  };

  const adapter = new OracleAdapter();

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("Running fillForm...");
  await adapter.fillForm(page, profile, { resumePath });

  // Inspect address values in DOM
  const addrValues = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden'])"));
    return inputs.map(i => {
      const inp = i as HTMLInputElement;
      return {
        id: inp.id,
        name: inp.name,
        value: inp.value
      };
    }).filter(x => x.value && (x.value.includes("aaradhya") || x.value.includes("limda") || x.value.includes("wagodhiya") || x.value.includes("Vadodara") || x.value.includes("390144")));
  });

  console.log("Verified Address Inputs in DOM:", JSON.stringify(addrValues, null, 2));

  await browser.close();
}

main().catch(console.error);
