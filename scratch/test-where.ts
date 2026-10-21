import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344708/apply/email");
  await page.waitForTimeout(3000);
  await page.fill("input#primary-email-1", "audit_where_" + Date.now() + "@gmail.com");
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
  });
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(6000);
  console.log("PAGE URL:", page.url());
  const h = await page.innerText("body");
  console.log("BODY SNIPPET:", h.slice(0, 300));
  await browser.close();
}

main().catch(console.error);
