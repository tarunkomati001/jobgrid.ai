import { chromium } from "playwright";

async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  await countryBtn.click();
  await page.waitForTimeout(500);

  const res = await page.evaluate(async () => {
    const menu = document.querySelector('[role="listbox"]');
    if (!menu) return { error: "No menu" };

    let scrollEl: HTMLElement | null = null;
    const candidates = Array.from(menu.querySelectorAll("*")) as HTMLElement[];
    for (const c of candidates) {
      if (c.scrollHeight > c.clientHeight) {
        scrollEl = c;
        break;
      }
    }
    if (!scrollEl) return { error: "No scroll container" };

    const maxScroll = scrollEl.scrollHeight;
    let foundOptionId = "";

    for (let pos = 0; pos <= maxScroll; pos += 200) {
      scrollEl.scrollTop = pos;
      scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
      await new Promise(r => setTimeout(r, 15));

      const opts = Array.from(scrollEl.querySelectorAll("[role='option']"));
      for (const opt of opts) {
        const text = opt.textContent || "";
        const label = opt.getAttribute("aria-label") || "";
        if (text.includes("United States") || label.includes("United States")) {
          foundOptionId = opt.id;
          (opt as HTMLElement).click();
          return { success: true, optionId: opt.id, label, text };
        }
      }
    }
    return { success: false };
  });

  console.log("Country selection result:", res);
  await page.waitForTimeout(1000);

  console.log("Country button text:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));

  const phoneInput = page.locator("input[name='candidate.phone']");
  console.log("Phone input value:", await phoneInput.inputValue());

  // Type phone number
  await phoneInput.click();
  // Clear and type
  await phoneInput.pressSequentially("5551234567", { delay: 50 });
  await page.waitForTimeout(500);
  console.log("Phone input after typing:", await phoneInput.inputValue());

  await browser.close();
}

check().catch(console.error);
