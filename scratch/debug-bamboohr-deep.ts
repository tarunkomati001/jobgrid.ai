import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function testPage(url: string) {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(async () => {
    console.log("networkidle timed out, waiting domcontentloaded...");
    await page.waitForLoadState("domcontentloaded").catch(() => {});
  });
  await page.waitForTimeout(4000);

  console.log("Current URL:", page.url());
  const bodyText = await page.locator("body").innerText().catch(() => "");
  console.log("Body snippet:", bodyText.slice(0, 500));

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a, input[type='button'], div[role='button']")).map(b => ({
      tag: b.tagName,
      text: (b.textContent || "").trim(),
      href: b.getAttribute("href"),
      ariaLabel: b.getAttribute("aria-label"),
      type: b.getAttribute("type"),
      id: b.id,
      classes: b.className
    })).filter(b => b.text || b.href || b.ariaLabel);
  });

  console.log("All interactive elements:", buttons);

  // If there's an apply button, let's click it!
  const applyBtn = page.locator("button:has-text('Apply'), a:has-text('Apply'), [role='button']:has-text('Apply')").first();
  if (await applyBtn.isVisible().catch(() => false)) {
    console.log("Found Apply button, clicking...");
    await applyBtn.click().catch(() => {});
    await page.waitForTimeout(4000);

    const postClickText = await page.locator("body").innerText().catch(() => "");
    console.log("Post click body snippet:", postClickText.slice(0, 500));

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
    console.log("Inputs found after clicking apply:", inputs);
  }

  await browser.close();
}

async function main() {
  await testPage("https://atlas.bamboohr.com/careers/633");
  await testPage("https://headspin.bamboohr.com/careers/331");
}

main().catch(console.error);

