import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function checkLabel() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const url = "https://wellfound.com/jobs/3293991-founding-software-engineer";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("[class*='actionBar'] button:has-text('Apply'), [class*='applyButton'], button:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const ta = page.locator("textarea").first();
  const label = await ta.evaluate((input: HTMLElement) => {
    // 1. Closest label
    const parentLabel = input.closest("label");
    if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

    // 2. Label with 'for' attribute matching input id
    if (input.id) {
      const forLabel = document.querySelector(`label[for='${input.id}']`);
      if (forLabel && forLabel.textContent) return forLabel.textContent.trim();
    }

    // 3. Previous sibling text
    const prev = input.previousElementSibling || input.parentElement?.previousElementSibling;
    if (prev && prev.textContent) return prev.textContent.trim();

    return input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.getAttribute("name") || "";
  });

  console.log("Associated label for textarea:", label);
  await context.close();
}

checkLabel().catch(console.error);

