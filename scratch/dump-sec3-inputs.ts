import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344708/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const email = `test_dom_${Date.now()}@gmail.com`;
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

  const phoneInp = page.locator("input.phone-row__input, input[type='tel']").first();
  if (await phoneInp.count() > 0) {
    await page.evaluate(() => {
      const el = document.querySelector("input.phone-row__input, input[type='tel']") as HTMLInputElement;
      if (el) {
        el.removeAttribute("readonly");
        el.value = "4155552671";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "500 Oracle Parkway").catch(() => {});
  
  const zipInp = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await zipInp.count() > 0) {
    await zipInp.fill("94065");
    await page.waitForTimeout(1000);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  }

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

  const nextBtn2 = page.locator("button:has-text('Next')").last();
  await nextBtn2.click();

  await page.waitForURL(url => url.toString().includes("/apply/section/3"), { timeout: 30000 });
  await page.waitForTimeout(3000);

  const inputs = await page.evaluate(() => {
    const list: any[] = [];
    document.querySelectorAll("input, select, textarea, button[role='combobox'], [role='combobox']").forEach(el => {
      const parent = el.closest(".form-block, .input-row, fieldset, div");
      const label = el.id ? document.querySelector(`label[for='${el.id}']`)?.textContent : "";
      list.push({
        tag: el.tagName,
        id: el.id,
        name: (el as any).name,
        type: (el as any).type,
        role: el.getAttribute("role"),
        ariaLabel: el.getAttribute("aria-label"),
        label: label?.trim(),
        parentText: parent?.textContent?.trim().substring(0, 100).replace(/\s+/g, " ")
      });
    });
    return list;
  });

  console.log("All Section 3 Form Elements:\n", JSON.stringify(inputs, null, 2));
  await browser.close();
}

main().catch(console.error);
