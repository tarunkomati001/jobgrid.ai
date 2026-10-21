import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Navigate directly to apply/email
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email");
  await page.waitForTimeout(3000);

  // Use test alias to skip OTP directly into Section 1
  const alias = `babufakemail+inspect${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1, input[type='email']", alias);
  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click(); else cb.click();
    }
  });
  await page.waitForTimeout(500);
  await page.click("button:has-text('Next')");

  for (let s = 0; s < 30; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/")) break;
  }
  await page.waitForTimeout(3000);

  // Fill minimal on Section 1
  await page.fill("input[name='firstName']", "Hrutin");
  await page.fill("input[name='lastName']", "Nammi");
  await page.fill("input[type='tel']", "8688423267");
  await page.locator("button.apply-flow-pagination__button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/2")) break;
  }
  await page.waitForTimeout(2000);

  // Section 2 Next
  await page.locator("button.apply-flow-pagination__button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/3")) break;
  }
  await page.waitForTimeout(4000);

  // Inspect the Yes/No buttons and their ancestors!
  const hierarchy = await page.evaluate(() => {
    const yesBtns = Array.from(document.querySelectorAll("button")).filter(b => b.textContent?.trim().toLowerCase() === "yes");
    return yesBtns.map(btn => {
      const ancestors: string[] = [];
      let curr = btn.parentElement;
      while (curr && curr !== document.body && ancestors.length < 8) {
        ancestors.push({
          tag: curr.tagName,
          className: curr.className,
          id: curr.id,
          textSnippet: curr.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) || ""
        } as any);
        curr = curr.parentElement;
      }
      return {
        btnText: btn.textContent?.trim(),
        btnClass: btn.className,
        ancestors
      };
    });
  });

  console.log("Hierarchy of Yes buttons:\n", JSON.stringify(hierarchy, null, 2));

  await browser.close();
}

main().catch(console.error);
