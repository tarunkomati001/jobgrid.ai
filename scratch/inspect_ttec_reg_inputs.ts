import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Accept agreement
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  // Click New User
  const newUserBtn = page.locator("#dialogTemplate-dialogForm-login-register, input[value='New User']").first();
  await newUserBtn.click();
  await page.waitForTimeout(4000);

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      label: document.querySelector(`label[for='${el.id}']`)?.textContent?.trim() || ""
    })).filter(x => x.type !== "hidden");
  });

  console.log("REGISTRATION INPUTS:", JSON.stringify(inputs, null, 2));
  await browser.close();
}

main().catch(console.error);

