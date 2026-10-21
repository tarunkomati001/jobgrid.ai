import { chromium } from "playwright";

async function dumpMenuDOM() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  await countryBtn.click();
  await page.waitForTimeout(500);

  const menuHTML = await page.evaluate(() => {
    // Find all elements with role='listbox' or id containing downshift
    const listbox = document.querySelector("[role='listbox']");
    if (!listbox) return "No listbox";
    return {
      id: listbox.id,
      className: listbox.className,
      outerHTML: listbox.outerHTML.slice(0, 1000),
      parentTag: listbox.parentElement?.tagName,
      parentClass: listbox.parentElement?.className,
      parentStyle: listbox.parentElement?.getAttribute("style"),
      parentChildrenCount: listbox.parentElement?.children.length,
      childrenInfo: Array.from(listbox.children).map(c => ({
        tag: c.tagName,
        class: c.className,
        style: c.getAttribute("style"),
        id: c.id,
        role: c.getAttribute("role"),
        text: c.textContent?.slice(0, 30)
      }))
    };
  });

  console.log("Menu DOM:", JSON.stringify(menuHTML, null, 2));

  await browser.close();
}

dumpMenuDOM().catch(console.error);
