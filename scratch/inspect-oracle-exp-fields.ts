import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `hrutin_inspect_exp_${Date.now()}@gmail.com`;
  console.log("Navigating to Oracle email step...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  // Wait for Section 1
  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Fill Sec 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "4155552671").catch(() => {});

  // Go to Sec 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Upload resume in Sec 2
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Go to Sec 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(8000);

  // Click edit on the invalid tile or first experience tile
  console.log("Opening Experience tile...");
  await page.evaluate(() => {
    const editBtn = document.querySelector(".apply-flow-profile-item-tile--invalid .apply-flow-profile-item-tile__edit-item-icon, .apply-flow-profile-item-tile__edit-item-icon") as HTMLElement;
    if (editBtn) editBtn.click();
  });
  await page.waitForTimeout(3000);

  // Dump EVERYTHING inside the active experience form
  const expFormData = await page.evaluate(() => {
    // Find the active form or container
    const activeTile = document.querySelector(".apply-flow-profile-item-tile--active, [class*='active'], form");
    const container = activeTile || document;

    const allInputs = Array.from(container.querySelectorAll("input, select, textarea, [role='combobox'], [role='listbox']"));
    const fields = allInputs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const l = document.querySelector(`label[for='${inp.id}']`);
        if (l) label = l.textContent?.trim() || "";
      }
      if (!label) {
        const p = inp.closest(".form-block, .field, .input-row, div");
        if (p) {
          const l = p.querySelector("label, .label, span.title");
          if (l) label = l.textContent?.trim() || "";
        }
      }
      return {
        tag: el.tagName,
        id: inp.id,
        name: inp.name,
        role: el.getAttribute("role"),
        type: inp.type,
        label,
        value: inp.value,
        ariaLabel: el.getAttribute("aria-label"),
        autocomplete: el.getAttribute("autocomplete"),
        placeholder: inp.placeholder
      };
    });

    const errorElements = Array.from(container.querySelectorAll(".error, [class*='error'], [aria-invalid='true'], [role='alert'], .oj-message-detail, .apply-flow-profile-item-tile__summary-validation"));
    const errors = errorElements.map(e => ({
      text: e.textContent?.trim(),
      className: e.className
    }));

    return { fields, errors };
  });

  console.log("=== EXPERIENCE FORM FIELDS ===");
  console.log(JSON.stringify(expFormData, null, 2));

  await browser.close();
}

main().catch(console.error);
