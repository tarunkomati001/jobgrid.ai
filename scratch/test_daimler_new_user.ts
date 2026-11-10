import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER00045QI&lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(4000);
  }

  await page.evaluate(() => {
    document.getElementById("usercentrics-root")?.remove();
  });

  const newUserBtn = page.locator("#dialogTemplate-dialogForm-login-register, input[value='New User']").first();
  console.log("Clicking New User button...");
  await newUserBtn.click({ force: true });
  await page.waitForTimeout(4000);

  console.log("URL after clicking New User:", page.url());
  const regInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      value: (el as any).value,
      placeholder: (el as any).placeholder,
      label: document.querySelector(`label[for='${el.id}']`)?.textContent?.trim() || ""
    }));
  });
  console.log("Registration Inputs on Daimler:", JSON.stringify(regInputs, null, 2));
  await browser.close();
}

main();

