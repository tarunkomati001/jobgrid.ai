import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating directly to apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Email
  await page.fill("input#primary-email-1", "hrutin_audit_fields@gmail.com");
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  // AUDIT SECTION 1
  console.log("=== AUDITING SECTION 1 ===");
  const sec1Fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox']"));
    return inputs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const l = document.querySelector("label[for='" + inp.id + "']");
        if (l) label = l.textContent?.trim() || "";
      }
      return {
        id: inp.id,
        name: inp.name,
        type: inp.type,
        label,
        value: inp.value,
        required: inp.required || inp.getAttribute("aria-required") === "true"
      };
    }).filter(x => x.id);
  });
  console.log("Section 1 Fields before fill:", JSON.stringify(sec1Fields, null, 2));

  // Fill Section 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "8688423267").catch(() => {});
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "ava street").catch(() => {});
  await page.fill("input[name='addressLine2'], input[id*='addressLine2']", "ava street").catch(() => {});
  await page.fill("input[name='postalCode'], input[id*='postalCode']", "390144").catch(() => {});
  await page.fill("input[name='city'], input[id*='city']", "Vadodara").catch(() => {});

  // Title / Prefix if present
  const titleField = page.locator("input[name='title'], input[id*='title-']").first();
  if (await titleField.count() > 0 && await titleField.isVisible()) {
    await titleField.fill("Mr.").catch(() => {});
  }

  // Upload resume
  const rInput = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput.count() > 0) {
    await rInput.setInputFiles(resumePath).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Signature on Sec 1 if present
  const fn1 = page.locator("input[name='fullName'], input[id*='fullName']").first();
  if (await fn1.count() > 0 && await fn1.isVisible()) {
    await fn1.fill("Hrutin Nammi").catch(() => {});
  }

  // Agree checkbox on Sec 1
  await page.evaluate(() => {
    const cb = document.getElementById("job-alerts-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const l = document.querySelector("label[for='job-alerts-checkbox']") as HTMLElement;
      if (l) l.click();
    }
  });

  await page.screenshot({ path: "scratch/audit_sec1_filled.png", fullPage: true });

  // Advance to Section 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);

  // AUDIT SECTION 2
  console.log("=== AUDITING SECTION 2 ===");
  await page.screenshot({ path: "scratch/audit_sec2_screen.png", fullPage: true });
  const sec2Details = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, .title, legend, label")).map(h => h.textContent?.trim()).filter(Boolean);
    const buttons = Array.from(document.querySelectorAll("button")).map(b => b.textContent?.trim()).filter(Boolean);
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(i => (i as any).id);
    return { headings, buttons, inputs };
  });
  console.log("Section 2 Elements:", JSON.stringify(sec2Details, null, 2));

  // Resume on Sec 2
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Advance to Section 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);

  // AUDIT SECTION 3
  console.log("=== AUDITING SECTION 3 ===");
  await page.screenshot({ path: "scratch/audit_sec3_screen.png", fullPage: true });

  const sec3Fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button[role='radio']"));
    return inputs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const l = document.querySelector("label[for='" + inp.id + "']");
        if (l) label = l.textContent?.trim() || "";
      }
      return {
        id: inp.id,
        name: inp.name,
        role: el.getAttribute("role"),
        text: el.textContent?.trim(),
        label,
        value: inp.value,
        ariaChecked: el.getAttribute("aria-checked"),
        checked: inp.checked
      };
    });
  });
  console.log("Section 3 Elements before fill:", JSON.stringify(sec3Fields, null, 2));

  await browser.close();
}

main().catch(console.error);
