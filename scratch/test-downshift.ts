import { chromium } from "playwright";

async function testDownshift() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const phoneInput = page.locator("input[name='candidate.phone']");
  console.log("Initial phone input value:", await phoneInput.inputValue());

  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));

  // Click country button
  await countryBtn.click();
  await page.waitForTimeout(500);

  // Check what items are in the listbox and how it behaves
  const listbox = page.locator("[role='listbox']");
  console.log("Listbox visible?", await listbox.isVisible());

  // Let's inspect the HTML of the listbox and its items
  const menuInfo = await page.evaluate(() => {
    const menu = document.querySelector("[role='listbox']");
    if (!menu) return null;
    const items = Array.from(menu.querySelectorAll("[role='option']"));
    return {
      id: menu.id,
      itemCount: items.length,
      sample: items.slice(0, 5).map(it => ({
        id: it.id,
        role: it.getAttribute("role"),
        ariaSelected: it.getAttribute("aria-selected"),
        text: it.textContent?.trim(),
        html: it.outerHTML
      }))
    };
  });
  console.log("Menu Info:", JSON.stringify(menuInfo, null, 2));

  // Can we type "United States" or "+1" using keyboard while the listbox or button is focused?
  console.log("Typing 'United States' on keyboard...");
  await page.keyboard.type("United States");
  await page.waitForTimeout(500);

  // Check which item is highlighted or if search filtered
  const afterTypeInfo = await page.evaluate(() => {
    const menu = document.querySelector("[role='listbox']");
    if (!menu) return null;
    const items = Array.from(menu.querySelectorAll("[role='option']"));
    const selected = items.find(it => it.getAttribute("aria-selected") === "true" || it.classList.contains("highlighted") || it.getAttribute("data-highlighted") === "true");
    return {
      selectedText: selected?.textContent?.trim(),
      allMatchingUS: items.filter(it => it.textContent?.includes("United States")).map(it => ({ id: it.id, text: it.textContent?.trim() }))
    };
  });
  console.log("After typing 'United States':", afterTypeInfo);

  // Can we find the option containing "United States" and scroll into view / click?
  const usOption = page.locator("[role='listbox'] [role='option']").filter({ hasText: /^United States/i }).first();
  console.log("US option count:", await usOption.count());
  if (await usOption.count() > 0) {
    console.log("Clicking US option...");
    await usOption.scrollIntoViewIfNeeded();
    await usOption.click();
    await page.waitForTimeout(500);
    console.log("New Country button text:", await countryBtn.innerText());
    console.log("New Country button aria-label:", await countryBtn.getAttribute("aria-label"));
    console.log("Phone input value now:", await phoneInput.inputValue());
  }

  // Now let's test entering phone number in phone field!
  console.log("\nTesting filling phone number...");
  // Recruitee phone input: let's see what happens when typing phone number
  await phoneInput.click();
  await phoneInput.fill(""); // clear
  await phoneInput.pressSequentially("5551234567", { delay: 50 });
  await page.waitForTimeout(500);
  console.log("Phone input after typing:", await phoneInput.inputValue());

  // Also check if user typed with +1 or without +1
  await phoneInput.fill("");
  await phoneInput.pressSequentially("+1 555 123 4567", { delay: 50 });
  await page.waitForTimeout(500);
  console.log("Phone input after typing full +1 555 123 4567:", await phoneInput.inputValue());

  await browser.close();
}

testDownshift().catch(console.error);
