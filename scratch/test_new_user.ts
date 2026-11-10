import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Accept
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton']").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  // Click "New User"
  const newUserBtn = page.locator("input[value='New User'], input[id*='register']").first();
  if (await newUserBtn.isVisible()) {
    console.log("Clicking New User...");
    await newUserBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log("URL:", page.url());
  console.log("Title:", await page.title());

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), button")).map(el => {
      const inp = el as any;
      return {
        id: el.id,
        name: inp.name,
        type: inp.type,
        label: (inp.labels && inp.labels[0]?.innerText) || el.closest("tr, td, div")?.querySelector("label, .label")?.innerText || ""
      };
    });
  });
  console.log("NEW USER INPUTS:", JSON.stringify(inputs, null, 2));

  await browser.close();
}

main();

