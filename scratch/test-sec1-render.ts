import { chromium } from "playwright";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+testsec${Date.now()}@gmail.com`;
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1100 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  console.log("Navigating to URL with fresh alias:", testAlias);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
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
  const nextBtn = page.locator("button:has-text('Next')").first();
  await nextBtn.click();

  // Wait for Section 1 to load (wait until spinner disappears and firstName appears)
  console.log("Waiting for Section 1 to render...");
  await page.waitForSelector("input[name='firstName'], input[id*='firstName'], input[name='lastName']", {
    state: "visible",
    timeout: 30000
  });
  console.log("✅ Section 1 rendered!");

  // Dump all inputs on Section 1
  const sec1Inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button[id*='toggle']")).map((el: any) => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      ariaLabel: el.getAttribute("aria-label"),
      value: el.value
    }));
  });
  console.log("Section 1 fields count:", sec1Inputs.length);
  console.log("Section 1 sample fields:", JSON.stringify(sec1Inputs.slice(0, 15), null, 2));

  await page.screenshot({ path: "scratch/test_sec1_rendered.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
