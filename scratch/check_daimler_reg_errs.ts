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

  const regSubmit = page.locator("#dialogTemplate-dialogForm-defaultCmd, input[value='Register']").first();
  await regSubmit.click({ force: true });
  await page.waitForTimeout(5000);

  const errs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".error, .errorMessage, [class*='error'], .text-danger, .tips")).map(el => el.textContent?.trim());
  });
  console.log("Errors / tips on registration form:", errs);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("Body text after reg submit:\n", bodyText.slice(0, 700));
  await browser.close();
}

main();

