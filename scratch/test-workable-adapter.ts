import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import { handleCloudflareTurnstile } from "../src/browser/turnstile-handler";
import { injectCursorVisualizer } from "../src/browser/human-mouse";
import { detectAndGetAdapter } from "../src/ats/ats-factory";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

async function runWorkableAdapterTest() {
  process.env.AUTO_SUBMIT = "true";
  process.env.DRY_RUN = "false";
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    portfolioUrl: "https://github.com/hrutinnammi",
    willingToRelocate: true,
    yearsOfExperience: 2,
    gender: "Male"
  };

  const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  const urls = [
    "https://apply.workable.com/rokt/j/7219AFDA7F/apply/",
    "https://apply.workable.com/rokt/j/8C792C8AC9/apply/",
    "https://apply.workable.com/rokt/j/33E0F9B588/apply/"
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n======================================================`);
    console.log(`RUNNING ADAPTER TEST [${i+1}/${urls.length}]: ${url}`);
    console.log(`======================================================\n`);

    // Open a fresh separate tab for each job so previous jobs stay open in their own tabs
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);
    await injectCursorVisualizer(page);

    const { ats, adapter } = await detectAndGetAdapter(page, url);
    console.log(`Detected ATS: ${ats}`);

    const isMatch = await adapter.detect(page);
    console.log(`Adapter detect check: ${isMatch}`);

    const job = await adapter.extractJob(page);
    console.log(`Extracted Job:`, JSON.stringify(job, null, 2));

    const fields = await adapter.extractFields(page);
    console.log(`Extracted Fields count: ${fields.length}`);
    fields.slice(0, 8).forEach(f => console.log(`  - [${f.type}] "${f.label}" (id: ${f.id}, req: ${f.required})`));

    await adapter.fillForm(page, profile, {}, fields);
    await adapter.uploadResume(page, resumePath, fields);

    const isValid = await adapter.validate(page, fields);
    console.log(`Validation result: ${isValid ? "PASSED ✅" : "FAILED ❌"}`);

    const submitRes = await adapter.submit(page);
    console.log(`Submit result:`, JSON.stringify(submitRes, null, 2));

    // Detect and resolve Cloudflare Turnstile if present on submit
    await handleCloudflareTurnstile(page, 15000);

    const shotPath = path.resolve(__dirname, `workable_adapter_result_${i+1}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved result screenshot to ${shotPath}`);
    console.log(`📌 Tab [${i+1}/${urls.length}] kept open on screen.`);
  }

  console.log("\n🎉 All 3 Workable applications completed! Keeping all tabs open on screen for your review.");
}

runWorkableAdapterTest().catch(console.error);
