import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const URLS = [
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/345236/?keyword=software+engineer",
  "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/338844/?keyword=software+engineers"
];
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const adapter = new OracleAdapter();

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\n======================================================`);
    console.log(`Testing Job ${i + 3}: ${url}`);
    console.log(`======================================================`);

    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    });

    const profile: UserProfile = {
      userId: "usr_hrutin_nammi",
      firstName: "Hrutin",
      lastName: "Nammi",
      email: `test_oracle_j${i + 3}_${Date.now()}@gmail.com`,
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

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await adapter.fillForm(page, profile, { resumePath });

    const isValid = await adapter.validate(page);
    console.log(`Job ${i + 3} Validation:`, isValid);

    const subResult = await adapter.submit(page);
    console.log(`Job ${i + 3} Submission Result:`, subResult);

    await page.screenshot({ path: `scratch/oracle_job${i + 3}_verified.png`, fullPage: true });
    await page.close();
  }

  await browser.close();
}

main().catch(console.error);
