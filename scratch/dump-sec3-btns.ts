import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+fulltest${Date.now()}@gmail.com`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
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
  await page.waitForTimeout(500);
  await page.locator("button:has-text('Next')").first().click();

  for (let s = 0; s < 25; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/")) break;
  }
  await page.waitForTimeout(3000);

  // Next from Sec 1 -> Sec 2
  await page.waitForSelector("button.apply-flow-pagination__button:has-text('Next'):not([disabled])", { timeout: 15000 }).catch(() => {});
  await page.locator("button.apply-flow-pagination__button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/2")) break;
  }
  await page.waitForTimeout(3000);

  // Next from Sec 2 -> Sec 3
  await page.waitForSelector("button.apply-flow-pagination__button:has-text('Next'):not([disabled])", { timeout: 15000 }).catch(() => {});
  await page.locator("button.apply-flow-pagination__button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/3")) break;
  }
  await page.waitForTimeout(3000);

  // DUMP ALL BUTTONS ON SECTION 3
  const dump = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"));
    return btns.map((b: any) => {
      const rect = b.getBoundingClientRect();
      return {
        tag: b.tagName,
        type: b.type,
        id: b.id,
        className: b.className,
        textContent: b.textContent?.trim(),
        innerText: b.innerText?.trim(),
        width: rect.width,
        height: rect.height,
        disabled: b.disabled,
        ariaLabel: b.getAttribute("aria-label"),
        dataQa: b.getAttribute("data-qa")
      };
    });
  });

  console.log("SECTION 3 BUTTONS DUMP:", JSON.stringify(dump, null, 2));
  await browser.close();
}

main().catch(console.error);
