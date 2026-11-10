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

  const userInput = page.locator("#dialogTemplate-dialogForm-login-name1");
  const passInput = page.locator("#dialogTemplate-dialogForm-login-password");
  const loginBtn = page.locator("#dialogTemplate-dialogForm-login-defaultCmd");

  await userInput.fill("babufakemail@gmail.com");
  await passInput.fill("ClucoPass@2026!Secure");
  await loginBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const fullText = await page.evaluate(() => document.body.innerText);
  console.log("Full page text after login attempt:\n", fullText);
  await browser.close();
}

main();

