import { chromium } from "playwright";

async function inspectVirtualizedList() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  await countryBtn.click();
  await page.waitForTimeout(500);

  // Let's inspect the scroll container of #downshift-0-menu
  const containerInfo = await page.evaluate(() => {
    const menu = document.querySelector("[role='listbox']");
    if (!menu) return "No menu";
    
    // Check menu parent and scroll properties
    return {
      menuTag: menu.tagName,
      menuId: menu.id,
      scrollHeight: menu.scrollHeight,
      clientHeight: menu.clientHeight,
      scrollTop: menu.scrollTop,
      parentElement: menu.parentElement?.tagName,
      parentScrollHeight: menu.parentElement?.scrollHeight,
      parentClientHeight: menu.parentElement?.clientHeight,
      parentClass: menu.parentElement?.className
    };
  });
  console.log("Container Info:", containerInfo);

  // Let's see what happens if we scroll the menu or scroll to bottom / top / middle
  // Let's scroll and look for United States
  const foundUS = await page.evaluate(async () => {
    const menu = document.querySelector("[role='listbox']");
    if (!menu) return { error: "No menu" };

    // Let's inspect all items while scrolling down or search for United States
    const totalScroll = menu.scrollHeight;
    let found = null;
    
    // Try scrolling step by step
    for (let top = 0; top <= totalScroll; top += 200) {
      menu.scrollTop = top;
      menu.dispatchEvent(new Event("scroll", { bubbles: true }));
      // wait a tiny bit
      await new Promise(r => setTimeout(r, 50));
      
      const items = Array.from(menu.querySelectorAll("[role='option']"));
      for (const item of items) {
        const text = item.textContent || "";
        const ariaLabel = item.getAttribute("aria-label") || "";
        if (text.includes("United States") || ariaLabel.includes("United States")) {
          found = {
            id: item.id,
            text,
            ariaLabel,
            scrollTop: top,
            html: item.outerHTML
          };
          break;
        }
      }
      if (found) break;
    }
    return { found, totalScroll };
  });

  console.log("Found US via scrolling?", foundUS);

  // Let's test clicking United States if found
  if (foundUS.found) {
    console.log("Clicking United States item...");
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView();
        el.click();
      }
    }, foundUS.found.id);

    await page.waitForTimeout(500);
    console.log("Country button text now:", await countryBtn.innerText());
    console.log("Country button aria-label now:", await countryBtn.getAttribute("aria-label"));

    const phoneInput = page.locator("input[name='candidate.phone']");
    console.log("Phone input value now:", await phoneInput.inputValue());
  }

  await browser.close();
}

inspectVirtualizedList().catch(console.error);
