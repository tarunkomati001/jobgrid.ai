import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function testPage(url: string) {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log(`\nNavigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(4000);

  console.log("Current URL:", page.url());
  const title = await page.title();
  console.log("Title:", title);

  const applyBtn = page.locator("button:has-text('Apply'), a:has-text('Apply'), [role='button']:has-text('Apply')").first();
  if (await applyBtn.isVisible().catch(() => false)) {
    console.log("Found Apply button, clicking...");
    await applyBtn.click().catch(() => {});
    await page.waitForTimeout(4000);
  }

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, textarea, select")).map(inp => ({
      tag: inp.tagName,
      type: inp.getAttribute("type") || inp.tagName,
      name: inp.getAttribute("name"),
      id: inp.id,
      placeholder: inp.getAttribute("placeholder"),
      ariaLabel: inp.getAttribute("aria-label"),
      label: inp.closest("label")?.textContent?.trim() || 
             document.querySelector(`label[for='${inp.id}']`)?.textContent?.trim() ||
             inp.closest("div[class*='field'], div[class*='Field'], div[class*='group']")?.querySelector("label, span")?.textContent?.trim() || ""
    }));
  });
  console.log(`Inputs found on ${url}: (${inputs.length})`);
  for (const i of inputs) {
    if (i.label || i.name) {
      console.log(`  - [${i.type}] name="${i.name}" id="${i.id}" label="${i.label}"`);
    }
  }

  await browser.close();
}

async function main() {
  await testPage("https://prentkeromich.bamboohr.com/careers/506");
  await testPage("https://greenparkcontent.bamboohr.com/careers/831");
}

main().catch(console.error);

