import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill("babufakemail@gmail.com");

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click(); else cb.click();
    }
  });
  await page.waitForTimeout(800);
  console.log("Clicking Next...");
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => {
    return {
      url: window.location.href,
      bodyText: document.body.innerText.slice(0, 1000),
      hasPinCode: !!document.getElementById("pin-code-1"),
      allInputs: Array.from(document.querySelectorAll("input")).map((i: any) => ({ id: i.id, name: i.name, type: i.type, val: i.value })),
      allButtons: Array.from(document.querySelectorAll("button")).map((b: any) => ({ text: b.textContent?.trim(), id: b.id, cls: b.className }))
    };
  });

  console.log("PAGE STATE AFTER EMAIL NEXT:", JSON.stringify(state, null, 2));
  await page.screenshot({ path: "scratch/oracle_after_email_next.png" });
  await browser.close();
}

main().catch(console.error);
