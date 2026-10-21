import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  console.log("--- Testing Playwright Shadow DOM piercing ---");
  const count = await page.locator("input").count();
  console.log("Playwright locator('input').count():", count);

  for (let i = 0; i < count; i++) {
    const loc = page.locator("input").nth(i);
    const id = await loc.getAttribute("id");
    const name = await loc.getAttribute("name");
    const type = await loc.getAttribute("type");
    const placeholder = await loc.getAttribute("placeholder");
    const ariaLabel = await loc.getAttribute("aria-label");
    const testId = await loc.getAttribute("data-test");
    console.log(`Input ${i}: id="${id}" name="${name}" type="${type}" placeholder="${placeholder}" aria="${ariaLabel}" testId="${testId}"`);
  }

  const buttons = await page.locator("button").count();
  console.log("\nPlaywright locator('button').count():", buttons);
  for (let i = 0; i < buttons; i++) {
    const btn = page.locator("button").nth(i);
    const text = await btn.innerText().catch(() => "");
    const dataTest = await btn.getAttribute("data-test");
    console.log(`Button ${i}: text="${text.replace(/\s+/g, ' ').trim()}" data-test="${dataTest}"`);
  }

  const textareas = await page.locator("textarea").count();
  console.log("\nPlaywright locator('textarea').count():", textareas);
  for (let i = 0; i < textareas; i++) {
    const ta = page.locator("textarea").nth(i);
    const id = await ta.getAttribute("id");
    const name = await ta.getAttribute("name");
    console.log(`Textarea ${i}: id="${id}" name="${name}"`);
  }

  await browser.close();
}

run().catch(console.error);
