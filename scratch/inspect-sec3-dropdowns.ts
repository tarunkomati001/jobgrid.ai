import { chromium } from "playwright";
import { OracleAdapter } from "../src/ats/oracle/oracle.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/347172/?keyword=engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const adapter = new OracleAdapter();
  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: `test_oracle_inspect_${Date.now()}@gmail.com`,
    phone: "4155552671",
    location: "Redwood City, CA, USA",
    street: "500 Oracle Parkway",
    city: "Redwood City",
    state: "California",
    zipCode: "94065",
    country: "United States",
    willingToRelocate: true,
    yearsOfExperience: 2,
    gender: "Male"
  };

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await adapter.fillForm(page, profile, { resumePath });

  // Now we are on Section 3! Inspect all dropdowns/selects
  const dropdowns = await page.evaluate(() => {
    const toggles = Array.from(document.querySelectorAll("button[id*='toggle'], button[aria-haspopup='listbox'], [role='combobox']"));
    return toggles.map(t => {
      const parent = t.closest(".input-row, .form-block, div, fieldset");
      const label = parent ? (parent.querySelector("label, .label, span.title, p")?.textContent?.trim()) : "";
      return {
        id: t.id,
        tag: t.tagName,
        ariaLabel: t.getAttribute("aria-label"),
        label,
        text: t.textContent?.trim()
      };
    });
  });

  console.log("Section 3 dropdown toggles found:", JSON.stringify(dropdowns, null, 2));

  // Inspect Gender button specifically
  const genderBtn = await page.evaluate(() => {
    const btn = document.querySelector("button[id*='GENDER'], button[id*='gender']") as HTMLElement;
    if (!btn) return null;
    return {
      id: btn.id,
      className: btn.className,
      text: btn.textContent?.trim(),
      parentHTML: btn.parentElement?.innerHTML?.slice(0, 300)
    };
  });
  console.log("Gender button inspection:", genderBtn);

  // Click gender button and see what options appear in DOM
  await page.evaluate(() => {
    const btn = document.querySelector("button[id*='GENDER'], button[id*='gender']") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);

  const genderOptions = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item, li"));
    return opts.map(o => ({
      text: o.textContent?.trim(),
      id: o.id,
      role: o.getAttribute("role"),
      className: o.className
    })).filter(x => x.text && x.text.length > 0 && x.text.length < 50);
  });
  console.log("Options appearing after clicking Gender:", genderOptions.slice(0, 10));

  await browser.close();
}

main().catch(console.error);
