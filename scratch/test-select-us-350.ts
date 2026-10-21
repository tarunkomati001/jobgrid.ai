import { chromium } from "playwright";

async function testSelectUSReliably350() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  await countryBtn.click();
  await page.waitForTimeout(300);

  const clicked = await page.evaluate(async () => {
    const scrollEl = document.querySelector(".sc-2arzqk-1, [role='listbox'] > div, [role='listbox']") as HTMLElement;
    if (!scrollEl) return false;

    // Scroll progressively in 350px steps
    for (let top = 0; top <= 14500; top += 350) {
      scrollEl.scrollTop = top;
      scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise(r => setTimeout(r, 15));

      const opts = Array.from(document.querySelectorAll("[role='option']"));
      const us = opts.find(o => o.getAttribute("aria-label")?.includes("United States") || o.textContent?.includes("United States"));
      if (us) {
        (us as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  console.log("Clicked US inside evaluate:", clicked);
  await page.waitForTimeout(500);

  console.log("Country button text:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));
  console.log("Phone input value:", await page.locator("input[name='candidate.phone']").inputValue());

  await browser.close();
}

testSelectUSReliably350().catch(console.error);
