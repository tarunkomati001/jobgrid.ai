import { chromium } from "playwright";

async function findUSPosition() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  await countryBtn.click();
  await page.waitForTimeout(300);

  const scan = await page.evaluate(async () => {
    const scrollEl = document.querySelector(".sc-2arzqk-1") as HTMLElement;
    if (!scrollEl) return "No scrollEl";

    const totalHeight = scrollEl.scrollHeight;
    const clientH = scrollEl.clientHeight;
    // scan from 0 to totalHeight step 500
    const sampled: any[] = [];
    for (let top = 0; top <= totalHeight; top += 500) {
      scrollEl.scrollTop = top;
      scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise(r => setTimeout(r, 20));

      const opts = Array.from(document.querySelectorAll("[role='option']"));
      const texts = opts.map(o => o.textContent?.trim() || '');
      sampled.push({ top, first: texts[0] });

      const us = opts.find(o => o.textContent?.includes("United States") || o.getAttribute("aria-label")?.includes("United States"));
      if (us) {
        return { found: true, top, text: us.textContent, id: us.id, ariaLabel: us.getAttribute("aria-label") };
      }
    }
    return { found: false, totalHeight, sampled };
  });

  console.log("Scan result:", scan);
  await browser.close();
}

findUSPosition().catch(console.error);
