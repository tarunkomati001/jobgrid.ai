import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER0003OP8&lang=en";
  console.log("Navigating to Daimler job MER0003OP8...");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // 1. Remove usercentrics overlay
  await page.evaluate(() => {
    document.getElementById("usercentrics-root")?.remove();
    document.querySelector("div[class*='usercentrics']")?.remove();
  });

  // 2. Click accept
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    console.log("Accepting Privacy Agreement...");
    await acceptBtn.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(4000);
  }

  // Remove usercentrics again
  await page.evaluate(() => {
    document.getElementById("usercentrics-root")?.remove();
    document.querySelector("div[class*='usercentrics']")?.remove();
  });

  // 3. Click New User
  console.log("Clicking New User...");
  await page.evaluate(() => {
    const btn = document.querySelector("#dialogTemplate-dialogForm-login-register") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(4000);

  const randSuffix = Date.now().toString().slice(-4);
  const uname = `hrutin_${randSuffix}`;
  const password = "ClucoPass@2026!Secure";
  const email = `babufakemail+${randSuffix}@gmail.com`;

  console.log(`Entering new account info: ${uname} / ${email}...`);
  await page.fill("#dialogTemplate-dialogForm-userName", uname);
  await page.fill("#dialogTemplate-dialogForm-password", password);
  await page.fill("#dialogTemplate-dialogForm-passwordConfirm", password);
  await page.fill("#dialogTemplate-dialogForm-email", email);
  await page.fill("#dialogTemplate-dialogForm-emailConfirm", email);

  console.log("Submitting Register via JSF / click...");
  await page.evaluate(() => {
    const btn = document.querySelector("#dialogTemplate-dialogForm-defaultCmd") as HTMLElement;
    if (btn) btn.click();
  });

  await page.waitForTimeout(6000);

  console.log("URL after Register:", page.url());
  console.log("Title after Register:", await page.title());

  // Check what step of the application we are on
  const stepText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log("Application Step text:\n", stepText);
  await page.screenshot({ path: "scratch/daimler_mer0003op8_step.png" });
  await browser.close();
}

main();

