import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER0003OP8&lang=en";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    document.getElementById("usercentrics-root")?.remove();
    document.querySelector("div[class*='usercentrics']")?.remove();
  });

  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(4000);
  }

  await page.evaluate(() => {
    document.getElementById("usercentrics-root")?.remove();
    document.querySelector("div[class*='usercentrics']")?.remove();
  });

  const newUserBtn = page.locator("#dialogTemplate-dialogForm-login-register, input[value='New User']").first();
  await newUserBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const randSuffix = Date.now().toString().slice(-4);
  const uname = `hrutin_${randSuffix}`;
  const password = "ClucoPass@2026!Secure";
  const email = `babufakemail+${randSuffix}@gmail.com`;

  await page.fill("#dialogTemplate-dialogForm-userName", uname);
  await page.fill("#dialogTemplate-dialogForm-password", password);
  await page.fill("#dialogTemplate-dialogForm-passwordConfirm", password);
  await page.fill("#dialogTemplate-dialogForm-email", email);
  await page.fill("#dialogTemplate-dialogForm-emailConfirm", email);

  await page.evaluate(() => {
    const btn = document.querySelector("#dialogTemplate-dialogForm-defaultCmd") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(6000);

  console.log("Current Step Title:", await page.title());

  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button, input[type='file'], input[type='button'], input[type='submit']")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      value: (el as any).value,
      text: el.textContent?.trim().slice(0, 30),
      label: document.querySelector(`label[for='${el.id}']`)?.textContent?.trim() || ""
    })).filter(x => x.id || x.name || x.label || x.value);
  });
  console.log("Step 1 Elements on Taleo Enterprise:", JSON.stringify(elements, null, 2));
  await browser.close();
}

main();

