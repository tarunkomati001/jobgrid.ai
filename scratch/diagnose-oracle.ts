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
    email: `test_oracle_${Date.now()}@gmail.com`,
    phone: "4155552671",
    location: "Redwood City, California, 94065, United States",
    street: "500 Oracle Parkway",
    city: "Redwood City",
    state: "California",
    zipCode: "94065",
    country: "United States",
    willingToRelocate: true,
    yearsOfExperience: 3,
    gender: "Male"
  };

  const adapter = new OracleAdapter();

  console.log(`1. Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Hook console errors
  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warn") {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    }
  });

  console.log("2. Running fillForm...");
  try {
    await adapter.fillForm(page, profile, { resumePath });
  } catch (err: any) {
    console.error("fillForm threw error:", err.message);
  }

  console.log("3. Current URL after fillForm:", page.url());

  // Inspect any error messages on page
  const errors = await page.evaluate(() => {
    const errEls = Array.from(document.querySelectorAll(".input-row--error, .apply-flow-field-error, .oj-text-field-error-message, [aria-invalid='true'], .apply-flow-error, .oj-message-detail, .oj-message-summary, [role='alert']"));
    return errEls.map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: el.textContent?.trim().replace(/\s+/g, " ")
    }));
  });

  console.log("4. Detected DOM error elements:", JSON.stringify(errors, null, 2));

  // Inspect all required fields and their values
  const requiredFields = await page.evaluate(() => {
    const reqs = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox']")).filter(el => {
      const isReq = (el as any).required || el.getAttribute("aria-required") === "true";
      const isVis = (el as HTMLElement).offsetWidth > 0;
      return isReq && isVis;
    });
    return reqs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        label = document.querySelector(`label[for='${inp.id}']`)?.textContent?.trim() || "";
      }
      return {
        id: inp.id,
        name: inp.name,
        label,
        type: inp.type || inp.tagName,
        value: inp.value || inp.getAttribute("aria-valuenow") || "",
        readonly: inp.readOnly || inp.getAttribute("readonly"),
        disabled: inp.disabled || inp.getAttribute("disabled")
      };
    });
  });

  console.log("5. Visible Required fields status:", JSON.stringify(requiredFields, null, 2));

  await page.screenshot({ path: "scratch/oracle_diag_result.png", fullPage: true });
  console.log("Saved diagnostic screenshot: scratch/oracle_diag_result.png");

  await browser.close();
}

main().catch(console.error);
