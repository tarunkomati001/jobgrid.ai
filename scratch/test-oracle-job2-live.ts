import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  console.log("=== Testing OracleAdapter on Job 344708 ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
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

  const adapter = new OracleAdapter();

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("Calling adapter.fillForm...");
  await adapter.fillForm(page, profile, { resumePath });

  const isValid = await adapter.validate(page);
  console.log("Validation status:", isValid);

  const sub = await adapter.submit(page);
  console.log("Submit status:", sub);

  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".error, [class*='error']:not(:empty), [aria-invalid='true'], .oj-message-detail"))
      .map(e => e.textContent?.trim())
      .filter(Boolean);
  });
  console.log("Page errors:", errors);

  await page.screenshot({ path: "scratch/oracle_job2_verified_clean.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
