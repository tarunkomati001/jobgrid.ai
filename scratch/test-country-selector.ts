import { chromium } from "playwright";

async function testCountry() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  console.log("Country button text before:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));

  // Click country button
  await countryBtn.click();
  await page.waitForTimeout(1000);

  // Inspect the listbox and options that appear
  const listboxInfo = await page.evaluate(() => {
    const listboxes = Array.from(document.querySelectorAll("[role='listbox'], ul[id*='downshift'], div[id*='downshift']"));
    const options = Array.from(document.querySelectorAll("[role='option']"));
    return {
      listboxes: listboxes.map(l => ({ id: l.id, role: l.getAttribute("role"), count: l.children.length, className: l.className })),
      optionsCount: options.length,
      sampleOptions: options.slice(0, 10).map(o => ({ id: o.id, text: o.textContent, ariaSelected: o.getAttribute("aria-selected") }))
    };
  });

  console.log("Listbox info after click:", JSON.stringify(listboxInfo, null, 2));

  // Let's test finding United States option
  const usOptions = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[role='option']"));
    return all.filter(o => o.textContent?.includes("United States") || o.getAttribute("aria-label")?.includes("United States")).map(o => ({
      id: o.id,
      text: o.textContent,
      ariaLabel: o.getAttribute("aria-label"),
      outerHTML: o.outerHTML.slice(0, 150)
    }));
  });
  console.log("US Options found in DOM without scrolling:", usOptions);

  await browser.close();
}

testCountry().catch(console.error);
