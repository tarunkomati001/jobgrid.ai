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

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill(testAlias);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click(); else cb.click();
    }
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  for (let s = 0; s < 30; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/")) break;
  }
  await page.waitForTimeout(3000);

  console.log("Analyzing Section 1 inputs & Knockout context...");
  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
    const data = inputs.map((inp: any) => ({
      id: inp.id,
      name: inp.name,
      type: inp.type,
      required: inp.required || inp.getAttribute("aria-required") === "true",
      value: inp.value,
      classes: inp.className,
      disabled: inp.disabled
    }));

    const nextBtn = document.querySelector("button[data-qa='applyFlowPaginationNextButton']") as any;
    return {
      inputs: data,
      nextBtnDisabled: nextBtn ? nextBtn.disabled : null,
      nextBtnText: nextBtn ? nextBtn.textContent?.trim() : null
    };
  });

  console.log("Section 1 info:", JSON.stringify(info, null, 2));
  await browser.close();
}

main().catch(console.error);
