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

  // Now check advance buttons
  const advanceButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("input[type='button'], input[type='submit'], button"));
    return btns.map(b => ({
      id: b.id,
      value: (b as any).value,
      text: b.textContent?.trim(),
      visible: (b as any).offsetParent !== null
    })).filter(x => x.value?.includes("Save") || x.value?.includes("Next") || x.text?.includes("Save") || x.text?.includes("Next"));
  });
  console.log("Visible Advance buttons on Resume Upload step:", advanceButtons);
  await browser.close();
}

main();

