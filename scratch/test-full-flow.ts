import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  console.log("1. Starting full Oracle test flow...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344708/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const email = `test_full_${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1, input[type='email']", email);
  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click(); else cb.click();
    }
  });
  await page.waitForTimeout(500);
  await page.click("button:has-text('Next')");

  await page.waitForURL(url => url.toString().includes("/apply/section/1"), { timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("2. Section 1 loaded. Filling personal details...");

  // Section 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin");
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi");
  
  const countryInp = page.locator("input[name='country']:not([id*='phone']), input[id*='country']:not([id*='phone'])").first();
  if (await countryInp.count() > 0) {
    await countryInp.fill("United States");
    await page.waitForTimeout(800);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  }

  // Safe Phone number filling (never timing out on readonly)
  await page.evaluate(() => {
    const el = document.querySelector("input.phone-row__input, input[type='tel']:not([role='combobox'])") as HTMLInputElement;
    if (el) {
      el.removeAttribute("readonly");
      el.value = "4155552671";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  });

  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "500 Oracle Parkway").catch(() => {});
  
  const zipInp = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await zipInp.count() > 0) {
    await zipInp.fill("94065");
    await page.waitForTimeout(1000);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  }

  // Section 1 Questions
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll("button")).filter(b => {
      const t = b.textContent?.trim().toLowerCase();
      return t === "yes" || t === "no";
    });
    for (const p of pills) {
      const t = p.textContent?.trim().toLowerCase();
      const parent = p.closest(".input-row, .form-block, fieldset, [class*='question']");
      const pText = (parent?.textContent || "").toLowerCase();
      if (pText.includes("ex-oracle") || pText.includes("government") || pText.includes("sponsorship")) {
        if (t === "no") (p as HTMLElement).click();
      } else {
        if (t === "yes") (p as HTMLElement).click();
      }
    }
  });

  await page.waitForTimeout(1500);
  await page.locator("button:has-text('Next')").last().click();

  await page.waitForURL(url => url.toString().includes("/apply/section/2"), { timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("3. Section 2 loaded. Adding resume, skill, education, and experience...");

  // Resume
  const fileInputs = page.locator("input[type='file']");
  if (await fileInputs.count() > 0) {
    await fileInputs.first().setInputFiles(resumePath);
    await page.waitForTimeout(2000);
  }

  // Skill
  const initialSkillBtn = page.locator("button:has-text('Add Skill')").first();
  if (await initialSkillBtn.count() > 0) {
    await initialSkillBtn.click();
    await page.waitForTimeout(800);
    const skillInput = page.locator("input[name='skills'], input[id*='skills']").first();
    await skillInput.fill("Full Stack AI Developer");
    const expInput = page.locator("input[name='yearsOfExperience'], input[id*='yearsOfExperience']").first();
    if (await expInput.count() > 0) await expInput.fill("3");
    await page.evaluate(() => {
      const formBlock = document.querySelector("input[name='skills']")?.closest(".form-block, form, div");
      const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
      const addBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "add skill" && b.getBoundingClientRect().height > 0);
      if (addBtn) addBtn.click();
    });
    await page.waitForTimeout(1200);
  }

  // Education
  const initialEduBtn = page.locator("button:has-text('Add Education')").first();
  if (await initialEduBtn.count() > 0) {
    await initialEduBtn.click();
    await page.waitForTimeout(800);
    const degInp = page.locator("input[name='contentItemId'], input[id*='contentItemId']").first();
    if (await degInp.count() > 0) {
      await degInp.fill("Bachelor of Technology");
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
    const majorInp = page.locator("input[name='major'], input[id*='major']").first();
    if (await majorInp.count() > 0) await majorInp.fill("Computer Science");
    const schoolInp = page.locator("input[name='educationalEstablishment'], input[id*='educationalEstablishment']").first();
    if (await schoolInp.count() > 0) {
      await schoolInp.fill("Parul University");
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
    const gpaInp = page.locator("input[name='gpa'], input[id*='gpa']").first();
    if (await gpaInp.count() > 0) await gpaInp.fill("3.8");
    await page.evaluate(() => {
      const cb = document.querySelector("input[type='checkbox'][name*='graduated' i]") as HTMLInputElement;
      if (cb && !cb.checked) {
        const lbl = cb.id ? document.querySelector(`label[for='${cb.id}']`) : cb.closest("label");
        if (lbl) (lbl as HTMLElement).click(); else cb.click();
      }
      const formBlock = document.querySelector("input[name='major']")?.closest(".form-block, form, div");
      const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
      const addBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "add education" && b.getBoundingClientRect().height > 0);
      if (addBtn) addBtn.click();
    });
    await page.waitForTimeout(1200);
  }

  // Experience
  const initialExpBtn = page.locator("button:has-text('Add Experience')").first();
  if (await initialExpBtn.count() > 0) {
    await initialExpBtn.click();
    await page.waitForTimeout(800);
    const empInp = page.locator("input[name='employerName'], input[id*='employerName']").first();
    if (await empInp.count() > 0) await empInp.fill("Jobspring");
    const titleInp = page.locator("input[name='jobTitle'], input[id*='jobTitle']").first();
    if (await titleInp.count() > 0) await titleInp.fill("Full Stack AI Developer");
    const smInp = page.locator("input[id*='month-startDate']").first();
    if (await smInp.count() > 0) {
      await smInp.fill("January");
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
    const syInp = page.locator("input[id*='year-startDate']").first();
    if (await syInp.count() > 0) {
      await syInp.fill("2024");
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
    const emInp = page.locator("input[id*='month-endDate']").first();
    if (await emInp.count() > 0) {
      await emInp.fill("January");
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
    const eyInp = page.locator("input[id*='year-endDate']").first();
    if (await eyInp.count() > 0) {
      await eyInp.fill("2026");
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
    await page.evaluate(() => {
      const formBlock = document.querySelector("input[name='employerName']")?.closest(".form-block, form, div");
      const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
      const addBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "add experience" && b.getBoundingClientRect().height > 0);
      if (addBtn) addBtn.click();
    });
    await page.waitForTimeout(1200);
  }

  // Links
  const linkInp = page.locator("input[name*='siteLink-1'], input[id*='siteLink-1']").first();
  if (await linkInp.count() > 0) {
    await linkInp.fill("https://linkedin.com/in/hrutinnammi");
  }

  const nextBtn2 = page.locator("button:has-text('Next')").last();
  await nextBtn2.click();

  await page.waitForURL(url => url.toString().includes("/apply/section/3"), { timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("4. Section 3 loaded! Filling Section 3 fields...");

  // Section 3: 1. Earliest Available Date
  const today = new Date();
  const dayStr = String(today.getDate()).padStart(2, "0");
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthQuery = monthNames[today.getMonth()];
  const yearStr = String(today.getFullYear());

  const mBtn = page.locator("button[id*='month-earliestAvailableDate'][id*='toggle']").first();
  if (await mBtn.count() > 0) {
    await mBtn.click();
    await page.waitForTimeout(400);
    await page.evaluate((mQ) => {
      const opts = Array.from(document.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item"));
      const m = opts.find(o => (o.textContent || "").toLowerCase().includes(mQ));
      if (m) (m as HTMLElement).click();
    }, monthQuery);
  }
  const dBtn = page.locator("button[id*='day-earliestAvailableDate'][id*='toggle']").first();
  if (await dBtn.count() > 0) {
    await dBtn.click();
    await page.waitForTimeout(400);
    await page.evaluate((dS) => {
      const opts = Array.from(document.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item"));
      const d = opts.find(o => o.textContent?.trim() === dS || o.textContent?.trim() === String(parseInt(dS, 10)));
      if (d) (d as HTMLElement).click();
    }, dayStr);
  }
  const yBtn = page.locator("button[id*='year-earliestAvailableDate'][id*='toggle']").first();
  if (await yBtn.count() > 0) {
    await yBtn.click();
    await page.waitForTimeout(400);
    await page.evaluate((yS) => {
      const opts = Array.from(document.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item"));
      const y = opts.find(o => o.textContent?.trim() === yS);
      if (y) (y as HTMLElement).click();
    }, yearStr);
  }

  // Section 3: 2. Smart screening questions
  await page.evaluate(() => {
    // Yes/No pill buttons
    const pills = Array.from(document.querySelectorAll("button")).filter(b => {
      const t = b.textContent?.trim().toLowerCase();
      return t === "yes" || t === "no";
    });
    for (const p of pills) {
      const t = p.textContent?.trim().toLowerCase();
      const parent = p.closest(".input-row, .form-block, fieldset, [class*='question']");
      const pText = (parent?.textContent || "").toLowerCase();
      if (pText.includes("ex-oracle") || pText.includes("government") || pText.includes("sponsorship")) {
        if (t === "no") (p as HTMLElement).click();
      } else {
        if (t === "yes") (p as HTMLElement).click();
      }
    }

    // Radio inputs (e.g. sponsorship radio group)
    const radios = Array.from(document.querySelectorAll("input[type='radio']")) as HTMLInputElement[];
    for (const r of radios) {
      const parent = r.closest(".input-row, .form-block, fieldset, [class*='question'], div");
      const pText = (parent?.textContent || "").toLowerCase();
      const rLabel = (r.id ? document.querySelector(`label[for='${r.id}']`)?.textContent : "") ||
                     r.closest("label")?.textContent ||
                     r.parentElement?.textContent || "";
      const isNo = rLabel.trim().toLowerCase() === "no" || r.value?.toLowerCase() === "no";
      const isYes = rLabel.trim().toLowerCase() === "yes" || r.value?.toLowerCase() === "yes";

      if (pText.includes("sponsorship") || pText.includes("ex-oracle") || pText.includes("government")) {
        if (isNo) {
          const clickTarget = (r.id ? document.querySelector(`label[for='${r.id}']`) : null) as HTMLElement || r;
          clickTarget.click();
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        if (isYes) {
          const clickTarget = (r.id ? document.querySelector(`label[for='${r.id}']`) : null) as HTMLElement || r;
          clickTarget.click();
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  });

  // Section 3: 3. Asian Checkbox
  await page.evaluate(() => {
    const asian = (document.getElementById("dq-option-5") || Array.from(document.querySelectorAll("input[type='checkbox']")).find(cb => {
      const l = cb.id ? document.querySelector(`label[for='${cb.id}']`)?.textContent : cb.closest("label")?.textContent;
      return l?.trim().toLowerCase() === "asian";
    })) as HTMLInputElement;
    if (asian && !asian.checked) {
      const l = (asian.id ? document.querySelector(`label[for='${asian.id}']`) : null) as HTMLElement;
      if (l) l.click(); else asian.click();
    }
  });

  // Section 3: 4. Gender Dropdown: Select "Male"
  console.log("Selecting Gender: Male...");
  const genderInput = page.locator("input[name*='GENDER'], input[id*='GENDER'], input[aria-label*='Gender' i]").first();
  const genderBtn = page.locator("button[id*='GENDER'], button[aria-label*='Gender' i]").first();

  if (await genderBtn.count() > 0) {
    await genderBtn.click();
  } else if (await genderInput.count() > 0) {
    await genderInput.click();
  }
  await page.waitForTimeout(600);

  // Select Male from list
  const genderSelected = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li, span"));
    const match = items.find(i => i.textContent?.trim().toLowerCase() === "male");
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  });
  console.log("Gender selected:", genderSelected);
  await page.waitForTimeout(600);

  // Section 3: 5. Veteran Status: Select "I am not a protected veteran"
  console.log("Selecting Veteran Status...");
  const vetBtn = page.locator("button[id*='VETERAN'], button[aria-label*='Veteran' i]").first();
  const vetInput = page.locator("input[name*='VETERAN'], input[id*='VETERAN']").first();
  if (await vetBtn.count() > 0) {
    await vetBtn.click();
  } else if (await vetInput.count() > 0) {
    await vetInput.click();
  }
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li, span"));
    const match = items.find(i => (i.textContent || "").toLowerCase().includes("not a protected veteran") || (i.textContent || "").toLowerCase().includes("not a veteran")) || items[items.length - 1];
    if (match) (match as HTMLElement).click();
  });
  await page.waitForTimeout(600);

  // Section 3: 6. Checkboxes (alerts & career emails)
  await page.evaluate(() => {
    const cbs = Array.from(document.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[];
    for (const cb of cbs) {
      if (cb.id === "dq-option-4" || cb.id === "dq-option-7" || cb.id === "dq-option-3" || cb.id === "dq-option-6" || cb.id === "dq-option-1") continue;
      if (!cb.checked) {
        if (cb.id) {
          const l = document.querySelector(`label[for='${cb.id}']`) as HTMLElement;
          if (l) l.click(); else cb.click();
        } else {
          cb.click();
        }
      }
    }
  });

  // Section 3: 7. Full Name E-Signature
  console.log("Filling E-Signature (Full Name)...");
  const sigInput = page.locator("input[name='fullName'], input[id*='fullName']").first();
  if (await sigInput.count() > 0) {
    await sigInput.fill("Hrutin Nammi");
    await sigInput.dispatchEvent("input");
    await sigInput.dispatchEvent("change");
    await sigInput.blur();
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/oracle_sec3_fully_filled.png", fullPage: true });

  // Check errors and submit button status
  const finalStatus = await page.evaluate(() => {
    const errEls = Array.from(document.querySelectorAll(".input-row--error, .apply-flow-field-error, .profile-inline-validation, [aria-invalid='true']:not([aria-invalid='false'])"));
    const visibleErrors = errEls.filter(el => (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0).map(el => el.textContent?.trim().replace(/\s+/g, " "));

    const btns = Array.from(document.querySelectorAll("button, input[type='submit']"));
    const submitBtn = btns.find(b => {
      const t = b.textContent?.trim().toLowerCase() || "";
      const isSub = t === "submit" || b.getAttribute("type") === "submit" || b.className.includes("submit");
      return isSub && (b as HTMLElement).offsetWidth > 0;
    });

    return {
      errorCount: visibleErrors.length,
      errors: visibleErrors,
      submitFound: !!submitBtn,
      submitDisabled: submitBtn ? (submitBtn as any).disabled : null
    };
  });

  console.log("FINAL SECTION 3 STATUS:\n", JSON.stringify(finalStatus, null, 2));

  await browser.close();
}

main().catch(console.error);
