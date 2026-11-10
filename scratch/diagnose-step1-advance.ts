import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { UserProfile } from "../src/types/user-profile";
import path from "path";

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "hrutinnammi123@gmail.com",
    phone: "2025550198",
    street: "123 Market St",
    addressLine2: "Suite 400",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    resumePath: path.resolve(process.cwd(), "resumes/user_usr_hrutin_nammi/resume.pdf"),
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    portfolioUrl: "https://github.com/hrutinnammi",
    workAuthorization: "Authorized to work in the US",
    willingToRelocate: true,
    yearsOfExperience: 3,
    gender: "Male"
  };

  const adapter = new PaylocityAdapter();
  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Details/4616387", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Fill form
  await adapter.fillForm(page, profile);
  await page.waitForTimeout(2000);

  // Diagnose why it didn't advance or if it did
  const diag = await page.evaluate(() => {
    const invalidInputs = Array.from(document.querySelectorAll(":invalid")).map(el => ({
      tagName: el.tagName,
      id: el.id,
      name: (el as any).name,
      validationMessage: (el as any).validationMessage,
      outer: el.outerHTML.slice(0, 200)
    }));

    const textDanger = Array.from(document.querySelectorAll(".text-danger, .has-error, .field-validation-error, span[style*='color: red']")).map(el => ({
      className: el.className,
      text: el.textContent?.trim()
    })).filter(x => x.text && x.text.length > 0);

    const step = Array.from(document.querySelectorAll("p, [class*='step']")).find(el => el.textContent?.includes("Step"))?.textContent?.trim();

    const stateWrapper = document.getElementById("public-site-address-us-state-select-wrapper");
    const stateInput = document.getElementById("public-site-address-us-state") as HTMLInputElement;

    return {
      step,
      invalidInputs,
      textDanger,
      stateWrapperText: stateWrapper?.textContent?.trim(),
      stateInputVal: stateInput?.value,
      stateValidationMsg: stateInput?.validationMessage
    };
  });

  console.log("DIAGNOSTIC REPORT:\n", JSON.stringify(diag, null, 2));
  await page.screenshot({ path: "scratch/step1_diagnose.png" });

  await browser.close();
}

diagnose().catch(console.error);
