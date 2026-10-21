import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  page.on("console", msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on("response", res => {
    if (res.status() >= 400) {
      console.log(`[HTTP ERROR] ${res.status()} ${res.url()}`);
    }
  });

  const adapter = new OracleAdapter();
  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_diag_${Date.now()}@gmail.com`,
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

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await adapter.fillForm(page, profile, { resumePath });

  // Check what error messages or popups exist
  const errors = await page.evaluate(() => {
    const errorEls = Array.from(document.querySelectorAll(".error, [class*='error'], [class*='toast'], [class*='notification'], [role='alert'], .oj-message"));
    return errorEls.map(e => ({
      class: e.className,
      text: e.textContent?.trim(),
      visible: (e as HTMLElement).offsetWidth > 0
    })).filter(e => e.text && e.text.length > 0);
  });
  console.log("Visible error elements on page:", JSON.stringify(errors, null, 2));

  await page.screenshot({ path: "scratch/oracle_diag_result.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
