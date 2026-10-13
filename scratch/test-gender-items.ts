import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344708/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.fill("input#primary-email-1", "check_g_123@gmail.com");
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
  });
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(6000);

  // Click Gender toggle
  await page.evaluate(() => {
    const btn = document.querySelector("button[id*='GENDER'][id*='toggle']") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);

  const items = await page.evaluate(() => {
    const listbox = document.querySelector("[id*='GENDER'][id*='listbox']");
    if (!listbox) return ["NO LISTBOX FOUND"];
    return Array.from(listbox.querySelectorAll(".cx-select__list-item, [role='option'], li")).map(e => e.textContent?.trim());
  });

  console.log("GENDER ITEMS:", items);
  await browser.close();
}

main().catch(console.error);
