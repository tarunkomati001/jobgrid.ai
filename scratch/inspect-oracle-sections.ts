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

  console.log("Waiting for URL to transition to application section...");
  for (let s = 0; s < 30; s++) {
    await page.waitForTimeout(1000);
    const curr = page.url();
    if (curr.includes("/section/") || (!curr.includes("/apply/email") && curr.includes("/apply/"))) {
      break;
    }
  }
  console.log("Current URL after email:", page.url());
  await page.waitForTimeout(5000);

  // Take screenshot of section 1
  await page.screenshot({ path: "scratch/oracle_section1_initial.png", fullPage: true });

  // Dump all inputs and buttons on Section 1
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button, [role='combobox'], [role='radio']")).map(el => {
      const e = el as any;
      const rect = e.getBoundingClientRect();
      return {
        tag: e.tagName,
        type: e.type || "",
        id: e.id || "",
        name: e.name || "",
        ariaLabel: e.getAttribute("aria-label") || "",
        text: e.textContent?.trim().slice(0, 40) || "",
        visible: rect.width > 0 && rect.height > 0,
        value: e.value || ""
      };
    }).filter(e => e.visible);
  });

  console.log("Interactive elements count:", elements.length);
  console.log("Sample elements:", JSON.stringify(elements.slice(0, 30), null, 2));

  await browser.close();
}

main().catch(console.error);
