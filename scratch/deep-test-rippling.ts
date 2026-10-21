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

  const testUrl = "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8";
  console.log(`🚀 [Deep Test Rippling]: Testing live URL: ${testUrl}`);

  const profile: UserProfile = {
    userId: "usr_test_rippling",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "hrutin.nammi@gmail.com",
    phone: "2025550198",
    street: "123 Market St",
    addressLine2: "Suite 400",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    location: "San Francisco, CA, United States",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    gender: "Male",
    workAuthorization: "Authorized",
    willingToRelocate: true,
    yearsOfExperience: 3,
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const { ats, adapter } = await detectAndGetAdapter(page, testUrl);
  console.log(`🎯 Detected ATS Platform: ${ats} (Expected: RIPPLING)`);

  console.log(`🌐 Navigating to ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const jobDetails = await adapter.extractJob(page);
  console.log(`📋 Extracted Job Details:`, jobDetails);

  const fields = await adapter.extractFields(page);
  console.log(`📊 Extracted ${fields.length} interactive fields.`);

  console.log(`✍️ Executing adapter.fillForm()...`);
  await adapter.fillForm(page, profile);

  const isValid = await adapter.validate(page);
  console.log(`🏁 Validation result: ${isValid ? "PASSED" : "FAILED"}`);

  const submitRes = await adapter.submit(page);
  console.log(`🚀 Submit preparation result:`, submitRes);

  await page.screenshot({ path: "scratch/rippling_deep_test_result.png", fullPage: true });

  const formAudit = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
    const emptyRequired = inputs.filter(i => {
      const isReq = (i as any).required || i.getAttribute("aria-required") === "true";
      const val = (i as HTMLInputElement).value || "";
      return isReq && !val && (i as HTMLInputElement).type !== "hidden";
    }).map(i => ({
      name: (i as any).name || i.id,
      testId: i.getAttribute("data-testid")
    }));

    const allValues = inputs.filter(i => (i as HTMLInputElement).type !== "hidden").map(i => ({
      name: (i as any).name || i.id || i.getAttribute("data-testid"),
      type: (i as any).type,
      val: (i as HTMLInputElement).value?.substring(0, 50)
    }));

    return {
      totalInputs: inputs.length,
      emptyRequiredCount: emptyRequired.length,
      emptyRequired,
      sampleValues: allValues.slice(0, 15)
    };
  });

  console.log("Form Audit:\n", JSON.stringify(formAudit, null, 2));

  await browser.close();
}

main().catch(console.error);
