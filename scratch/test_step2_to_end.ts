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

  await page.waitForFunction(() => {
    return !!document.querySelector("input[id*='saveContinueCmdBottom']");
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Advance Step 1 (Resume Upload)
  console.log("Step 1 Title:", await page.title());
  const saveBtn = page.locator("input[id*='saveContinueCmdBottom']").first();
  await saveBtn.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(5000);

  // Step 2 (Privacy Statement)
  console.log("Step 2 Title:", await page.title());
  const fullNameInp = page.locator("input[id*='dv_cs_esignature_FullName'], input[name*='dv_cs_esignature_FullName']").first();
  if (await fullNameInp.isVisible()) {
    console.log("Filling eSignature Full Name: Hrutin Nammi...");
    await fullNameInp.fill("Hrutin Nammi");
  }

  const saveBtn2 = page.locator("input[id*='saveContinueCmdBottom']").first();
  await saveBtn2.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(5000);

  // Step 3 (Personal Information)
  console.log("Step 3 Title:", await page.title());
  const step3Elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      value: (el as any).value,
      label: document.querySelector(`label[for='${el.id}']`)?.textContent?.trim() || ""
    })).filter(x => x.id || x.name || x.label);
  });
  console.log("Step 3 Elements (Personal Information):", JSON.stringify(step3Elements.slice(0, 20), null, 2));

  await browser.close();
}

main();

