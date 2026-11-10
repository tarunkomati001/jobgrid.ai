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

  console.log("Waiting for flow.jsf to mount...");
  await page.waitForFunction(() => {
    return window.location.href.includes("flow.jsf") || !!document.querySelector("input[id*='saveContinueCmdBottom']");
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log("Mounted URL:", page.url());
  console.log("Mounted Title:", await page.title());

  // Check advance button now
  const saveBtn = page.locator("input[id*='saveContinueCmdBottom']").first();
  console.log("saveContinueCmdBottom count:", await saveBtn.count(), "visible:", await saveBtn.isVisible());

  if (await saveBtn.isVisible()) {
    console.log("Clicking Save and Continue...");
    await saveBtn.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(5000);
    console.log("Step 2 URL:", page.url());
    console.log("Step 2 Title:", await page.title());
  }

  await browser.close();
}

main();

