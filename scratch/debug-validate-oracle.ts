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

  const adapter = new OracleAdapter();
  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_val_${Date.now()}@gmail.com`,
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

  const valDebug = await page.evaluate(() => {
    const rawErrors = Array.from(document.querySelectorAll(".error, [class*='error']:not(:empty), [aria-invalid='true'], .oj-message-detail"));
    const detailed = rawErrors.map(e => ({
      tag: e.tagName,
      className: e.className,
      id: e.id,
      text: e.textContent?.trim(),
      ariaInvalid: e.getAttribute("aria-invalid"),
      displayed: (e as HTMLElement).offsetParent !== null,
      rect: e.getBoundingClientRect()
    }));

    const buttons = Array.from(document.querySelectorAll("button"));
    const submitBtn = buttons.find(b => b.textContent?.trim().toLowerCase() === "submit" || b.type === "submit");

    return {
      detailed,
      hasSubmitBtn: !!submitBtn,
      submitBtnText: submitBtn?.textContent?.trim()
    };
  });

  console.log("Validation details:", JSON.stringify(valDebug, null, 2));
  await browser.close();
}

main().catch(console.error);
