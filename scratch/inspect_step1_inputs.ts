import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { getUserProfile } from "../src/database/user-profile.service";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const profile = await getUserProfile("hrutin");
  const adapter = new PaylocityAdapter();

  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Fill step 1 text inputs and comboboxes
  const res = await page.evaluate(() => {
    // Find all inputs on step 1
    return Array.from(document.querySelectorAll("input, select, [role='combobox']")).map(el => {
      const inp = el as any;
      return {
        id: inp.id,
        name: inp.name,
        type: inp.type,
        value: inp.value,
        ariaLabel: inp.getAttribute("aria-label"),
        visible: (el as HTMLElement).offsetParent !== null,
        required: inp.required || el.hasAttribute("required")
      };
    }).filter(x => x.visible && x.type !== "hidden");
  });
  console.log("VISIBLE INPUTS ON STEP 1:", JSON.stringify(res, null, 2));

  await browser.close();
}

main();

