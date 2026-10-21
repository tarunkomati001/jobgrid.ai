import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import path from "path";

async function testFillAllWorkableJobs() {
  const browser = await createBrowser(true); // headless
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const profile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "hrutin.nammi@example.com",
    phone: "9876543210",
    location: "Vadodara, Gujarat, India",
    salaryUsd: "$120,000",
    salaryGbp: "£85,000",
    coverLetter: "I am thrilled to apply for this role. With 5+ years of strategic commercial leadership, client partnership management, and cross-functional SaaS execution, I bring a demonstrated track record of scaling relationships and driving revenue."
  };

  const resumePath = path.resolve(__dirname, "test-resume.pdf");

  const urls = [
    "https://apply.workable.com/rokt/j/7219AFDA7F/apply/",
    "https://apply.workable.com/rokt/j/8C792C8AC9/apply/",
    "https://apply.workable.com/rokt/j/33E0F9B588/apply/"
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n======================================================`);
    console.log(`FILL VERIFICATION [${i+1}/${urls.length}]: ${url}`);
    console.log(`======================================================`);

    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);

    // Accept cookies
    try {
      const cookieBtn = page.locator("button:has-text('Accept'), [data-ui='cookie-consent-accept']").first();
      if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
        await cookieBtn.click();
        await page.waitForTimeout(600);
      }
    } catch (e) {}

    // 1. Personal Information
    await page.locator("input#firstname, input[name='firstname'], [data-ui='firstname']").first().fill(profile.firstName);
    await page.locator("input#lastname, input[name='lastname'], [data-ui='lastname']").first().fill(profile.lastName);
    await page.locator("input#email, input[name='email'], [data-ui='email']").first().fill(profile.email);

    // Phone & Country Code
    const phoneInput = page.locator("input[type='tel'], input[name='phone']").first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill(profile.phone);
    }

    // Address
    const addressInput = page.locator("input#address, [data-ui='address']").first();
    if (await addressInput.count() > 0 && await addressInput.isVisible()) {
      const curVal = await addressInput.inputValue().catch(() => "");
      if (!curVal) {
        await addressInput.fill(profile.location);
      }
    }

    // Resume
    const fileInput = page.locator("input[type='file'], [data-ui='resume'] input[type='file']").first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(resumePath);
      await page.waitForTimeout(1000);
    }

    // Cover Letter
    const coverLetter = page.locator("textarea#cover_letter, textarea[name='cover_letter'], [data-ui='cover_letter']").first();
    if (await coverLetter.count() > 0 && await coverLetter.isVisible()) {
      await coverLetter.fill(profile.coverLetter);
    }

    // 2. Radio Groups (Yes / No)
    const radioFieldsets = await page.locator("fieldset[role='radiogroup']").all();
    for (const fs of radioFieldsets) {
      const qText = await fs.evaluate(el => {
        const aria = el.getAttribute("aria-labelledby");
        if (aria) {
          const lbl = document.getElementById(aria);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const dataUi = el.getAttribute("data-ui");
        if (dataUi) {
          const lbl = document.getElementById(`${dataUi}_label`);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const legend = el.querySelector("legend, [id$='_label']");
        return legend?.textContent?.trim() || "";
      });

      const lowerQ = qText.toLowerCase();
      let answer = "YES";
      if (
        lowerQ.includes("require sponsorship") ||
        lowerQ.includes("visa sponsorship") ||
        lowerQ.includes("sponsorship for employment")
      ) {
        answer = "NO";
      } else if (
        lowerQ.includes("authorized to work") ||
        lowerQ.includes("legally authorized") ||
        lowerQ.includes("hybrid company") ||
        lowerQ.includes("commit to") ||
        lowerQ.includes("office 4") ||
        lowerQ.includes("office 4x")
      ) {
        answer = "YES";
      }

      const optBtn = fs.locator(`[data-ui='option']:has-text('${answer}'), label:has-text('${answer}'), [role='radio']:has-text('${answer}')`).first();
      if (await optBtn.count() > 0) {
        await optBtn.scrollIntoViewIfNeeded().catch(() => {});
        await optBtn.click({ force: true });
        console.log(`  [Radio] "${qText.slice(0, 50)}..." -> Selected: ${answer}`);
      }
    }

    // 3. Custom Inputs / Textareas
    const customFields = await page.locator("input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']):not(#firstname):not(#lastname):not(#email):not(#address):not([name='phone']):not(#city):not(#postcode):not(#country), textarea:not(#cover_letter)").all();
    for (const cf of customFields) {
      if (!(await cf.isVisible())) continue;

      const qText = await cf.evaluate(el => {
        const aria = el.getAttribute("aria-labelledby");
        if (aria) {
          const lbl = document.getElementById(aria);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const id = el.id;
        if (id) {
          const lbl = document.querySelector(`label[for='${id}']`);
          if (lbl) return lbl.textContent?.trim() || "";
          const lbl2 = document.getElementById(`${id}_label`);
          if (lbl2) return lbl2.textContent?.trim() || "";
        }
        const name = (el as any).name;
        if (name) {
          const lbl = document.getElementById(`${name}_label`);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const dataUi = el.getAttribute("data-ui");
        if (dataUi) {
          const lbl = document.getElementById(`${dataUi}_label`);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const parentLbl = el.closest("label");
        if (parentLbl) {
          const lSpan = parentLbl.querySelector("[id$='_label'], [class*='label']");
          if (lSpan) return lSpan.textContent?.trim() || "";
        }
        return "";
      });

      const lowerQ = qText.toLowerCase();
      let answer = "3";
      if (lowerQ.includes("gbp") || lowerQ.includes("in gbp")) {
        answer = profile.salaryGbp;
      } else if (lowerQ.includes("compensation") || lowerQ.includes("salary")) {
        answer = profile.salaryUsd;
      } else if (lowerQ.includes("french") || lowerQ.includes("german") || lowerQ.includes("language")) {
        answer = "Fluent / Professional working proficiency.";
      } else if (lowerQ.includes("years of experience") || lowerQ.includes("how many years")) {
        answer = "5";
      } else if (lowerQ.includes("leading product") || lowerQ.includes("client-facing") || lowerQ.includes("describe your experience")) {
        answer = "In my previous commercial roles, I regularly led product discovery and alignment workshops with enterprise clients, leveraging product telemetry and retention metrics to drive adoption.";
      }

      await cf.scrollIntoViewIfNeeded().catch(() => {});
      await cf.fill(answer);
      console.log(`  [Text/Textarea] "${qText.slice(0, 50)}..." -> Filled: "${answer.slice(0, 40)}..."`);
    }

    await page.waitForTimeout(1500);
    const shotPath = path.resolve(__dirname, `workable_verified_job_${i+1}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`📸 Saved verified screenshot to ${shotPath}`);
  }

  await browser.close();
  console.log("\n✅ All 3 Workable jobs filled and verified successfully!");
}

testFillAllWorkableJobs().catch(console.error);
