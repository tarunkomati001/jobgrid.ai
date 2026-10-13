import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const adapter = new OracleAdapter();

  console.log(`Testing Job 1: ${URL}`);
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_j1_${Date.now()}@gmail.com`,
    phone: "8688423267",
    location: "ava street, Vadodara, Gujarat, 390144, India",
    street: "ava street",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390144",
    country: "India",
    willingToRelocate: true,
    yearsOfExperience: 2,
    gender: "Male"
  };

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await adapter.fillForm(page, profile, { resumePath });

  const isValid = await adapter.validate(page);
  console.log(`Job 1 Validation:`, isValid);

  const subResult = await adapter.submit(page);
  console.log(`Job 1 Submission Result:`, subResult);

  await page.screenshot({ path: "scratch/oracle_job1_verified.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
