import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_postal2_${Date.now()}@gmail.com`;
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Set Country to United States
  const countryInp = page.locator("input[name='country']:not([id*='phone'])").first();
  const cId = await countryInp.getAttribute("id") || "country-12";
  await page.evaluate((id) => {
    const btn = document.getElementById(id + "-reset-button") || document.querySelector(`button[id*='${id}'][id*='reset']`);
    if (btn) (btn as HTMLElement).click();
  }, cId);
  await page.waitForTimeout(500);

  await countryInp.click();
  await countryInp.fill("United States");
  await page.waitForTimeout(1000);
  await page.evaluate((id) => {
    const listbox = document.getElementById(id + "-listbox");
    const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], .cx-select__list-item") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
    const match = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
    if (match) (match as HTMLElement).click();
  }, cId);
  await page.waitForTimeout(3000);

  // Postal code
  const pinInp = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  const pinId = await pinInp.getAttribute("id");
  console.log("Postal Code Input ID:", pinId);

  await pinInp.click();
  await pinInp.fill("94065");
  console.log("Filled 94065, waiting for loading to finish...");

  // Wait for loading to finish
  const listboxSelector = `#${pinId}-listbox`;
  await page.waitForSelector(`${listboxSelector} .cx-select__list-item:not(.cx-select__list-item--loading), ${listboxSelector} [role='option']`, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const options = await page.evaluate((lbSel) => {
    const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list");
    const items = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item, [role='option']") : []);
    return items.map(i => ({
      text: i.textContent?.trim().replace(/\s+/g, " "),
      className: i.className,
      role: i.getAttribute("role")
    }));
  }, listboxSelector);

  console.log("Loaded postal options:\n", JSON.stringify(options, null, 2));

  // Click the redwood city option
  const clickedItem = await page.evaluate((lbSel) => {
    const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list");
    const items = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item, [role='option']") : []);
    const match = items.find(i => {
      const t = (i.textContent || "").toLowerCase();
      return t.includes("redwood") || (t.includes("94065") && t.includes("ca"));
    }) || items[0];

    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim().replace(/\s+/g, " ");
    }
    return null;
  }, listboxSelector);

  console.log("Clicked postal item:", clickedItem);
  await page.waitForTimeout(3000);

  const postState = await page.evaluate(() => {
    return {
      postalCode: (document.querySelector("input[name='postalCode']") as any)?.value,
      city: (document.querySelector("input[name='city']") as any)?.value,
      county: (document.querySelector("input[name='region1']") as any)?.value,
      state: (document.querySelector("input[name='region2'], input[name='state']") as any)?.value
    };
  });

  console.log("POST SELECTION STATE:\n", JSON.stringify(postState, null, 2));
  await page.screenshot({ path: "scratch/postal_selected_success.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
