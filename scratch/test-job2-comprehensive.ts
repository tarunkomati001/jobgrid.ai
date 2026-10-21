import { chromium } from "playwright";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to Job 2:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill(`test_comprehensive_${Date.now()}@gmail.com`);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
      if (l) (l as HTMLElement).click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(5000);

  // SECTION 1
  console.log("Filling Section 1...");
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "8688423267").catch(() => {});
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "ava street").catch(() => {});
  await page.fill("input[name='addressLine2'], input[id*='addressLine2']", "ava street").catch(() => {});
  await page.fill("input[name='postalCode'], input[id*='postalCode']", "390144").catch(() => {});
  await page.fill("input[name='city'], input[id*='city']", "Vadodara").catch(() => {});

  // Signature on Sec 1 if present
  await page.fill("input[name='fullName'], input[id*='fullName']", "Hrutin Nammi").catch(() => {});

  // Next to Sec 2
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const nextBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "next");
    if (nextBtn) nextBtn.click();
  });
  await page.waitForTimeout(6000);

  // SECTION 2
  console.log("On Section 2, uploading resume...");
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Next to Sec 3
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const nextBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "next");
    if (nextBtn) nextBtn.click();
  });
  await page.waitForTimeout(6000);

  console.log("On Section 3! Answering all questions and fields...");

  // 1. Date Available
  const monthBtn = page.locator("button[id*='month-earliestAvailableDate'][id*='toggle']").first();
  if (await monthBtn.count() > 0 && await monthBtn.isVisible()) {
    await monthBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='month-earliestAvailableDate'][id*='listbox'] .cx-select__list-item"));
      const match = items.find(i => i.textContent?.toLowerCase().includes("oct")) || items[9];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(400);
  }

  const dayBtn = page.locator("button[id*='day-earliestAvailableDate'][id*='toggle']").first();
  if (await dayBtn.count() > 0 && await dayBtn.isVisible()) {
    await dayBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='day-earliestAvailableDate'][id*='listbox'] .cx-select__list-item"));
      const match = items.find(i => i.textContent?.trim() === "1" || i.textContent?.trim() === "01") || items[0];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(400);
  }

  const yearInput = page.locator("input[id*='year-earliestAvailableDate']").first();
  if (await yearInput.count() > 0 && await yearInput.isVisible()) {
    await yearInput.fill("2026");
    await page.keyboard.press("Enter");
  }

  // 2. SMART SCREENING QUESTION ANSWERER
  console.log("Running smart question answerer for all radio questions...");
  const answeredCount = await page.evaluate(() => {
    let count = 0;
    // Find all question containers
    const rows = Array.from(document.querySelectorAll(".input-row, .form-block, [class*='question'], [class*='field-container'], fieldset, section"));
    for (const row of rows) {
      const label = (row.querySelector("label, .label, legend, span.title, .input-row__label")?.textContent || "").toLowerCase();
      const text = (row.textContent || "").toLowerCase();
      const combined = label + " " + text;

      // Find radios inside this row
      const buttonRadios = Array.from(row.querySelectorAll("button[role='radio']")) as HTMLElement[];
      const inputRadios = Array.from(row.querySelectorAll("input[type='radio']")) as HTMLInputElement[];

      if (buttonRadios.length >= 2) {
        // Determine whether answer should be Yes or No
        let wantYes = true;
        if (
          combined.includes("ex-oracle") ||
          combined.includes("former employee") ||
          combined.includes("left oracle") ||
          combined.includes("government") ||
          combined.includes("public official") ||
          combined.includes("sponsorship") ||
          combined.includes("require sponsorship") ||
          combined.includes("felony") ||
          combined.includes("convict") ||
          combined.includes("disciplinary") ||
          combined.includes("terminated")
        ) {
          wantYes = false;
        }

        const targetText = wantYes ? "yes" : "no";
        const btn = buttonRadios.find(b => b.textContent?.trim().toLowerCase() === targetText);
        if (btn && btn.getAttribute("aria-checked") !== "true") {
          btn.click();
          count++;
        }
      }

      if (inputRadios.length >= 2) {
        let wantYes = true;
        if (
          combined.includes("ex-oracle") ||
          combined.includes("former employee") ||
          combined.includes("left oracle") ||
          combined.includes("government") ||
          combined.includes("public official") ||
          combined.includes("sponsorship") ||
          combined.includes("require sponsorship") ||
          combined.includes("felony") ||
          combined.includes("convict") ||
          combined.includes("disciplinary") ||
          combined.includes("terminated")
        ) {
          wantYes = false;
        }

        const targetText = wantYes ? "yes" : "no";
        for (const inp of inputRadios) {
          const l = row.querySelector(`label[for='${inp.id}']`)?.textContent?.toLowerCase() || "";
          if (l.includes(targetText) && !inp.checked) {
            const lbl = row.querySelector(`label[for='${inp.id}']`) as HTMLElement;
            if (lbl) lbl.click();
            else inp.click();
            count++;
          }
        }
      }
    }
    return count;
  });
  console.log(`Answered ${answeredCount} screening questions!`);

  // 3. Race / Ethnicity: Check Asian
  console.log("Selecting Ethnicity/Race: Asian...");
  await page.evaluate(() => {
    const asianCb = document.getElementById("dq-option-5") as HTMLInputElement;
    if (asianCb && !asianCb.checked) {
      const l = document.querySelector("label[for='dq-option-5']") as HTMLElement;
      if (l) l.click();
      else asianCb.click();
    }
  });

  // 4. Gender Dropdown
  console.log("Selecting Gender: Male...");
  const genderToggle = page.locator("button[id*='GENDER'][id*='toggle']").first();
  if (await genderToggle.count() > 0 && await genderToggle.isVisible()) {
    await genderToggle.click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='GENDER'][id*='listbox'] .cx-select__list-item, [id*='GENDER'][id*='listbox'] [role='option']"));
      const match = items.find(i => i.textContent?.toLowerCase().includes("male")) || items[0];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(400);
  } else {
    // Fill text if combobox input
    const genderInp = page.locator("input[name*='GENDER'], input[id*='GENDER']").first();
    if (await genderInp.count() > 0 && await genderInp.isVisible()) {
      await genderInp.fill("Male");
      await page.keyboard.press("Enter");
    }
  }

  // 5. Veteran Status Dropdown
  console.log("Selecting Veteran Status: I AM NOT A PROTECTED VETERAN...");
  const vetToggle = page.locator("button[id*='VETERAN'][id*='toggle']").first();
  if (await vetToggle.count() > 0 && await vetToggle.isVisible()) {
    await vetToggle.click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='VETERAN'][id*='listbox'] .cx-select__list-item, [id*='VETERAN'][id*='listbox'] [role='option']"));
      const match = items.find(i => i.textContent?.toLowerCase().includes("not a protected veteran")) || items[0];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(400);
  }

  // 6. Checkboxes (Agreements)
  console.log("Checking all consent checkboxes...");
  await page.evaluate(() => {
    const cbs = Array.from(document.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[];
    for (const cb of cbs) {
      if (!cb.checked) {
        if (cb.id) {
          const l = document.querySelector(`label[for='${cb.id}']`) as HTMLElement;
          if (l) l.click();
          else cb.click();
        } else {
          cb.click();
        }
      }
    }
  });

  // 7. Full Name Signature
  console.log("Signing Full Name: Hrutin Nammi...");
  const sigInput = page.locator("input[name='fullName'], input[id*='fullName']").first();
  if (await sigInput.count() > 0 && await sigInput.isVisible()) {
    await sigInput.fill("Hrutin Nammi");
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/oracle_job2_fully_filled.png", fullPage: true });

  // Verification report
  const report = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, button[role='radio']"));
    return inputs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const l = document.querySelector(`label[for='${inp.id}']`);
        if (l) label = l.textContent?.trim() || "";
      }
      return {
        id: inp.id || null,
        name: inp.name || null,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || null,
        label: label.slice(0, 40),
        text: el.textContent?.trim().slice(0, 30),
        value: inp.value !== undefined ? inp.value : null,
        checked: inp.checked !== undefined ? inp.checked : el.getAttribute('aria-checked')
      };
    }).filter(x => x.value || x.checked === 'true' || x.checked === true);
  });

  console.log(`\nVerified ${report.length} filled elements on Job 2:`);
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch(console.error);
