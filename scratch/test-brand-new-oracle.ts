import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const NEW_URL = "https://careers.oracle.com/en/sites/jobsearch/job/347172/?keyword=engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  console.log(`\n======================================================`);
  console.log(`DEEP TESTING BRAND NEW ORACLE CLOUD JOB: ${NEW_URL}`);
  console.log(`======================================================`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const adapter = new OracleAdapter();

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_newjob_${Date.now()}@gmail.com`,
    phone: "4155552671",
    location: "Redwood City, CA, USA",
    street: "500 Oracle Parkway",
    city: "Redwood City",
    state: "California",
    zipCode: "94065",
    country: "United States",
    willingToRelocate: true,
    yearsOfExperience: 2,
    gender: "Male"
  };

  console.log("Detecting ATS...");
  await page.goto(NEW_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const isOracle = await adapter.detect(page);
  console.log("ATS Detected as Oracle:", isOracle);

  const jobDetails = await adapter.extractJob(page);
  console.log("Extracted Job Details:", jobDetails);

  console.log("Running fillForm on brand new job...");
  await adapter.fillForm(page, profile, { resumePath });

  const isValid = await adapter.validate(page);
  console.log("Validation Result:", isValid);

  const sub = await adapter.submit(page);
  console.log("Submission Result:", sub);

  await page.screenshot({ path: "scratch/oracle_brand_new_job_verified.png", fullPage: true });

  const pageErrors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".error, [class*='error']:not(:empty), [aria-invalid='true'], .oj-message-detail"))
      .map(e => e.textContent?.trim())
      .filter(t => t && !t.includes("optional"));
  });
  console.log("Remaining Errors on Page:", pageErrors);

  await browser.close();
}

main().catch(console.error);
