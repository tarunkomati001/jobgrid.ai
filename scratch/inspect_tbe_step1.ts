import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5403", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Click Apply
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(3000);

  const randSuffix = Date.now().toString().slice(-4);
  const email = `babufakemail+${randSuffix}@gmail.com`;

  // Fill credentials as new user
  console.log(`Entering new credentials for ${email}...`);
  await page.fill("input[name='email']", email);
  await page.fill("input[name='cwsPassword']", "ClucoPass@2026!Secure");
  await page.fill("input[name='cwsPassword_2']", "ClucoPass@2026!Secure");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(4000);

  console.log("Current URL after registration:", page.url());

  // Dump all inputs on the active step
  const step1Data = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    const inputs = Array.from(active ? active.querySelectorAll("input, select, textarea") : document.querySelectorAll("input, select, textarea")).map(el => {
      const inp = el as any;
      let lbl = "";
      if (inp.id) lbl = document.querySelector(`label[for='${inp.id}']`)?.textContent?.trim() || "";
      if (!lbl && inp.name) {
        lbl = inp.closest(".form-group, tr, td, div")?.querySelector("label")?.textContent?.trim() || "";
      }
      return {
        tag: el.tagName,
        id: inp.id,
        name: inp.name,
        type: inp.type,
        value: inp.value,
        required: inp.required || inp.getAttribute("aria-required") === "true" || !!inp.closest(".required"),
        label: lbl
      };
    }).filter(x => x.type !== "hidden");

    return inputs;
  });

  console.log("STEP 1 INPUTS AFTER NEW USER:", JSON.stringify(step1Data, null, 2));
  await browser.close();
}

main().catch(console.error);
