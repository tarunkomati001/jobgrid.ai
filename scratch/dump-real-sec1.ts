import { chromium } from "playwright";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+dumpsec1_${Date.now()}@gmail.com`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

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

  await page.locator("button:has-text('Next')").first().click();

  console.log("Waiting for URL to include /section/1...");
  await page.waitForURL(url => url.toString().includes("/section/1"), { timeout: 25000 });
  await page.waitForTimeout(5000);

  const html = await page.content();
  fs.writeFileSync("scratch/real_section1.html", html, "utf8");
  console.log("Dumped real_section1.html, size:", html.length);

  // Check all form elements inside main or form
  const forms = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, select, textarea, button, form-element-label, [class*='input-row']"));
    return all.map((el: any) => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      text: el.textContent?.trim().slice(0, 40),
      className: el.className
    })).filter((x: any) => x.id || x.name || x.text);
  });
  fs.writeFileSync("scratch/section1_elements.json", JSON.stringify(forms, null, 2), "utf8");
  console.log("Saved section1_elements.json, items count:", forms.length);

  await page.screenshot({ path: "scratch/real_section1.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
