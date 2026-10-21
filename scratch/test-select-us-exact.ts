import { chromium } from "playwright";

async function testSelectUSExact() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  await countryBtn.click();
  await page.waitForTimeout(300);

  // Scroll the .sc-2arzqk-1 container
  const found = await page.evaluate(async () => {
    const scrollEl = document.querySelector(".sc-2arzqk-1") as HTMLElement;
    if (!scrollEl) return { error: "No .sc-2arzqk-1" };

    // Search around 13000 to 14200
    for (let top = 13000; top <= 14200; top += 100) {
      scrollEl.scrollTop = top;
      scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise(r => setTimeout(r, 40));

      const opts = Array.from(document.querySelectorAll("[role='option']"));
      for (const opt of opts) {
        if (opt.getAttribute("aria-label")?.includes("United States") || opt.textContent?.includes("United States")) {
          (opt as HTMLElement).click();
          return { success: true, text: opt.textContent, top, id: opt.id };
        }
      }
    }
    return { error: "Not found in range" };
  });

  console.log("Scroll result:", found);
  await page.waitForTimeout(500);

  console.log("Country button text after:", await countryBtn.innerText());
  console.log("Country button aria-label after:", await countryBtn.getAttribute("aria-label"));

  await browser.close();
}

testSelectUSExact().catch(console.error);
