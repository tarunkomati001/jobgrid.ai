import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `hrutin_exp_detail_${Date.now()}@gmail.com`;
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

  // Click edit specifically inside the EXPERIENCE block!
  console.log("Finding Experience block...");
  const clickedExp = await page.evaluate(() => {
    const allBlocks = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block"));
    const expBlock = allBlocks.find(b => {
      const heading = b.querySelector(".apply-flow-block__title, h2, h3")?.textContent?.trim().toLowerCase() || "";
      return heading.includes("experience");
    });
    if (!expBlock) return "NO_EXP_BLOCK";

    const invalidTile = expBlock.querySelector(".apply-flow-profile-item-tile--invalid") || expBlock.querySelectorAll(".apply-flow-profile-item-tile")[1];
    if (!invalidTile) return "NO_INVALID_TILE";

    const editBtn = invalidTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit'], button[aria-label='Edit']") as HTMLElement;
    if (editBtn) {
      editBtn.click();
      return "CLICKED_EDIT_IN_EXP";
    }
    return "NO_EDIT_BTN_IN_EXP";
  });

  console.log("Clicked Experience Edit Result:", clickedExp);
  await page.waitForTimeout(3000);

  // Dump all inputs and form fields inside that opened experience form
  const expFormFields = await page.evaluate(() => {
    const allBlocks = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block"));
    const expBlock = allBlocks.find(b => {
      const heading = b.querySelector(".apply-flow-block__title, h2, h3")?.textContent?.trim().toLowerCase() || "";
      return heading.includes("experience");
    });
    if (!expBlock) return null;

    const form = expBlock.querySelector("form, .standard-apply-flow-profile-item, .profile-item-form, [class*='profile-item']");
    const container = form || expBlock;

    const inputs = Array.from(container.querySelectorAll("input, select, textarea, [role='combobox'], [role='listbox'], button"));
    return inputs.map(el => {
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
        type: inp.type,
        role: el.getAttribute("role"),
        label,
        ariaLabel: el.getAttribute("aria-label"),
        value: inp.value,
        text: el.textContent?.trim()?.slice(0, 30)
      };
    }).filter(x => x.id || x.label || x.name || x.text);
  });

  console.log("=== EXPERIENCE OPENED FORM FIELDS ===");
  console.log(JSON.stringify(expFormFields, null, 2));

  // Check validation messages / errors inside experience block
  const expErrors = await page.evaluate(() => {
    const allBlocks = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block"));
    const expBlock = allBlocks.find(b => b.textContent?.toLowerCase().includes("experience"));
    if (!expBlock) return [];
    const errs = Array.from(expBlock.querySelectorAll(".error, [class*='error'], [aria-invalid='true'], [role='alert'], .oj-message-detail, .summary-validation, [data-bind*='validation']"));
    return errs.map(e => e.textContent?.trim()).filter(Boolean);
  });

  console.log("Experience Errors / Issues:", expErrors);

  await browser.close();
}

main().catch(console.error);
