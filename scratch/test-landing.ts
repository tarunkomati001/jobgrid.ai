import { chromium } from "playwright";

async function testLanding() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  console.log("Current URL:", page.url());
  const forms = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("form")).map(f => ({
      action: f.action,
      id: f.id,
      className: f.className,
      inputs: Array.from(f.querySelectorAll("input")).map(i => ({ name: i.name, id: i.id, type: i.type, visible: (i as HTMLElement).offsetParent !== null }))
    }));
  });
  console.log("Forms on landing page:", JSON.stringify(forms, null, 2));

  // Check apply button
  const applyBtn = page.locator("button:has-text('Apply'), a:has-text('Apply'), [data-cy='apply-button']");
  console.log("Apply buttons found:", await applyBtn.count());
  for (let i = 0; i < await applyBtn.count(); i++) {
    const text = await applyBtn.nth(i).innerText().catch(() => "");
    const tag = await applyBtn.nth(i).evaluate(el => el.tagName);
    const href = await applyBtn.nth(i).getAttribute("href").catch(() => null);
    console.log(`Apply btn ${i}: <${tag}> text="${text}" href="${href}"`);
  }

  await browser.close();
}

testLanding().catch(console.error);
