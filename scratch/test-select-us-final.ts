import { chromium } from "playwright";

const URLS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

async function testSelectUSFinal() {
  const browser = await chromium.launch({ headless: true });
  for (const url of URLS) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
    const phoneInput = page.locator("input[name='candidate.phone'], input[type='tel']").first();

    console.log(`\n======================================================`);
    console.log(`Testing: ${url}`);
    console.log(`Before: country="${await countryBtn.innerText()}" phone="${await phoneInput.inputValue()}"`);

    // First: Click country button to open dropdown
    await countryBtn.click();
    await page.waitForTimeout(300);

    // Scroll .sc-2arzqk-1 to 13500 and click United States
    const clicked = await page.evaluate(async () => {
      const scrollEl = document.querySelector(".sc-2arzqk-1") as HTMLElement;
      if (!scrollEl) return false;

      for (let top = 13000; top <= 14000; top += 100) {
        scrollEl.scrollTop = top;
        scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise(r => setTimeout(r, 20));

        const opts = Array.from(document.querySelectorAll("[role='option']"));
        const us = opts.find(o => o.getAttribute("aria-label") === "United States" || o.textContent?.includes("United States"));
        if (us) {
          (us as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    console.log(`Dropdown selection: clicked=${clicked}`);
    await page.waitForTimeout(400);

    // If dropdown is still open for any reason, close it by clicking body or Esc
    if (await page.locator("[role='listbox']").count() > 0) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);
    }

    // Now type US phone number
    await phoneInput.click();
    await phoneInput.fill("");
    // Use US area code: 415 or 202
    await phoneInput.pressSequentially("+1 202 555 0198", { delay: 30 });
    await page.waitForTimeout(300);

    console.log(`After: country="${await countryBtn.innerText()}" phone="${await phoneInput.inputValue()}"`);
    await page.close();
  }
  await browser.close();
}

testSelectUSFinal().catch(console.error);
