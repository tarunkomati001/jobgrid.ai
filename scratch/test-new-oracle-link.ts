import { chromium } from "playwright";
import { detectAndGetAdapter } from "../src/ats/ats-factory";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  // Test with NEW Oracle requisition link
  const newOracleUrl = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
  console.log(`🚀 Deep testing brand new Oracle link: ${newOracleUrl}`);

  const profile: UserProfile = {
    userId: "usr_test_oracle",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_new_${Date.now()}@gmail.com`,
    phone: "4155552671",
    street: "500 Oracle Parkway",
    addressLine2: "Suite 100",
    city: "Redwood City",
    state: "California",
    zipCode: "94065",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    gender: "Male",
    workAuthorization: "Authorized",
    willingToRelocate: true,
    yearsOfExperience: 3,
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  // 1. Detect ATS and instantiate adapter
  const { ats, adapter } = await detectAndGetAdapter(page, newOracleUrl);
  console.log(`🎯 Detected ATS Platform: ${ats} (Expected: ORACLE)`);

  // 2. Extract Job Info
  await page.goto(newOracleUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const jobInfo = await adapter.extractJob(page);
  console.log(`📋 Extracted Job:`, jobInfo);

  // 3. Extract Form Fields
  const fields = await adapter.extractFields(page);
  console.log(`📊 Extracted initial fields count: ${fields.length}`);

  // 4. Run fillForm across all sections
  console.log(`✍️ Executing adapter.fillForm()...`);
  await adapter.fillForm(page, profile, { resumePath: profile.resumePath });

  // 5. Check validation and final screenshot
  const isValid = await adapter.validate(page);
  console.log(`\n========================================`);
  console.log(`🏁 OracleAdapter.validate result: ${isValid ? "PASSED (No errors, submit enabled)" : "FAILED"}`);
  console.log(`========================================\n`);

  await page.screenshot({ path: "scratch/oracle_new_link_final_result.png", fullPage: true });

  const finalCheck = await page.evaluate(() => {
    const errs = Array.from(document.querySelectorAll(".apply-flow-field-error, .input-row--error, [aria-invalid='true']:not([aria-invalid='false']), .oj-text-field-error-message"))
      .filter(e => (e as HTMLElement).offsetWidth > 0 && (e as HTMLElement).offsetHeight > 0)
      .map(e => e.textContent?.trim().replace(/\s+/g, " "));

    const submitBtn = Array.from(document.querySelectorAll("button, input[type='submit']")).find(b => {
      const t = b.textContent?.trim().toLowerCase() || "";
      return (t === "submit" || b.getAttribute("type") === "submit") && (b as HTMLElement).offsetWidth > 0;
    });

    return {
      currentUrl: window.location.href,
      errorCount: errs.length,
      errors: errs,
      submitReady: !!submitBtn,
      submitDisabled: submitBtn ? (submitBtn as any).disabled : null
    };
  });

  console.log("Detailed Page Check:\n", JSON.stringify(finalCheck, null, 2));

  await browser.close();
}

main().catch(console.error);
