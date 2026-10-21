import { chromium } from "playwright";

async function testScrollVirtual() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  await countryBtn.click();
  await page.waitForTimeout(500);

  // Inspect the scroll container inside or around #downshift-0-menu
  const containerInfo = await page.evaluate(() => {
    const menu = document.querySelector("#downshift-0-menu, [role='listbox']");
    if (!menu) return { error: "No menu" };

    let scrollEl: HTMLElement | null = null;
    let cur: HTMLElement | null = menu as HTMLElement;
    while (cur) {
      if (cur.scrollHeight > cur.clientHeight && cur.clientHeight > 0) {
        scrollEl = cur;
        break;
      }
      cur = cur.parentElement;
    }
    // Also check children
    const allDivs = Array.from(menu.querySelectorAll("div"));
    const scrollDiv = allDivs.find(d => d.scrollHeight > d.clientHeight && d.clientHeight > 0);

    return {
      menuTagName: menu.tagName,
      menuClass: menu.className,
      menuScrollHeight: menu.scrollHeight,
      menuClientHeight: menu.clientHeight,
      parentScrollEl: scrollEl ? { tag: scrollEl.tagName, class: scrollEl.className, scrollHeight: scrollEl.scrollHeight, clientHeight: scrollEl.clientHeight } : null,
      scrollChild: scrollDiv ? { tag: scrollDiv.tagName, class: scrollDiv.className, scrollHeight: scrollDiv.scrollHeight, clientHeight: scrollDiv.clientHeight } : null
    };
  });

  console.log("Container info:", containerInfo);

  // Let's test scrolling the scrollable container and see how options re-render
  const scrollSelector = containerInfo.scrollChild ? `.${containerInfo.scrollChild.class.split(" ")[0]}` : "#downshift-0-menu";
  console.log("Using scroll element, testing scroll...");

  const testScrolls = [1000, 5000, 10000, 13000, 13500, 14000];
  for (const s of testScrolls) {
    await page.evaluate((top) => {
      const scrollEl = document.querySelector("#downshift-0-menu")?.firstElementChild as HTMLElement || document.querySelector("#downshift-0-menu") as HTMLElement;
      if (scrollEl) {
        scrollEl.scrollTop = top;
        scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    }, s);
    await page.waitForTimeout(300);

    const rendered = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option']"));
      return opts.map(o => ({ id: o.id, text: o.textContent?.trim() }));
    });
    console.log(`Scroll top ${s}: rendered ${rendered.length} options:`, rendered.map(r => r.text).join(", "));
    const foundUS = rendered.find(r => r.text?.includes("United States"));
    if (foundUS) {
      console.log(`🎯 FOUND UNITED STATES AT scrollTop = ${s}! Option id = ${foundUS.id}`);
      // Click it!
      await page.locator(`#${foundUS.id}`).click();
      await page.waitForTimeout(500);
      console.log("Country button text after click:", await countryBtn.innerText());
      console.log("Phone input value:", await page.locator("input[name='candidate.phone']").inputValue());
      break;
    }
  }

  await browser.close();
}

testScrollVirtual().catch(console.error);
