import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "path";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+fulltest${Date.now()}@gmail.com`;
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  console.log("Navigating to URL:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill(testAlias);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);

  console.log("Submitting email...");
  await page.locator("button:has-text('Next')").first().click();

  console.log("Waiting for Section 1...");
  for (let s = 0; s < 30; s++) {
    await page.waitForTimeout(1000);
    const curr = page.url();
    if (curr.includes("/section/") || (!curr.includes("/apply/email") && curr.includes("/apply/"))) break;
  }
  await page.waitForTimeout(3000);

  // Fill Section 1
  console.log("Filling Section 1...");
  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count() > 0) await fileInput.setInputFiles(resumePath);
  const fn = page.locator("input[name='firstName'], input[id*='firstName']").first();
  if (await fn.count() > 0) await fn.fill("Hrutin");
  const ln = page.locator("input[name='lastName'], input[id*='lastName']").first();
  if (await ln.count() > 0) await ln.fill("Nammi");
  const phoneCountryToggle = page.locator("button[id*='country-codes-dropdownphoneNumber']").first();
  if (await phoneCountryToggle.count() > 0) {
    await page.evaluate(() => {
      const btn = document.querySelector("button[id*='country-codes-dropdownphoneNumber']") as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='country-codes-dropdownphoneNumber'] [role='option'], [id*='country-codes-dropdownphoneNumber'] .cx-select__list-item"));
      const india = items.find(i => i.textContent?.toLowerCase().includes("india") || i.textContent?.includes("+91"));
      if (india) (india as HTMLElement).click();
    });
  }
  const phoneInp = page.locator("input[type='tel']").first();
  if (await phoneInp.count() > 0) await phoneInp.fill("8688423267");
  await page.waitForTimeout(1000);

  // Click Next -> Section 2
  console.log("Advancing to Section 2...");
  await page.locator("button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/2")) break;
  }
  console.log("Current URL:", page.url());
  await page.waitForTimeout(3000);

  // Fill Section 2: Upload resume if input exists, fill Link 1
  console.log("Filling Section 2...");
  const sec2Resume = page.locator("input#attachment-upload-2").first();
  if (await sec2Resume.count() > 0) {
    await sec2Resume.setInputFiles(resumePath);
    console.log("Uploaded resume on Section 2.");
    await page.waitForTimeout(2000);
  }

  const link1 = page.locator("input[name*='siteLink-1'], input[id*='siteLink-1']").first();
  if (await link1.count() > 0) {
    await link1.fill("https://linkedin.com/in/hrutinnammi");
  }

  // Click Next -> Section 3
  console.log("Advancing to Section 3...");
  await page.locator("button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/3") || page.url().includes("/section/4")) break;
  }
  console.log("Current URL after Section 2 Next:", page.url());
  await page.waitForTimeout(4000);

  // Dump elements on Section 3
  const sec3Elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button, [role='combobox'], [role='radio']")).map(el => {
      const e = el as any;
      const rect = e.getBoundingClientRect();
      let label = "";
      if (e.id) {
        label = document.querySelector(`label[for='${e.id}']`)?.textContent?.trim() || "";
      }
      return {
        tag: e.tagName,
        type: e.type || "",
        id: e.id || "",
        name: e.name || "",
        label,
        ariaLabel: e.getAttribute("aria-label") || "",
        text: e.textContent?.trim().slice(0, 50) || "",
        visible: rect.width > 0 && rect.height > 0,
        value: e.value || ""
      };
    }).filter(e => e.visible);
  });

  console.log("Section 3 elements count:", sec3Elements.length);
  console.log("Section 3 elements:", JSON.stringify(sec3Elements, null, 2));

  await browser.close();
}

main().catch(console.error);
