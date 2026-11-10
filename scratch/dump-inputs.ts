import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function dumpAllInputsAfterApply() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const url = "https://wellfound.com/jobs/4855345-senior-software-engineer-client-lifecycle";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("[class*='actionBar'] button:has-text('Apply'), [class*='applyButton'], button:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(4000);

  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, label, textarea, select, a, button")).map(el => {
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        name: el.getAttribute("name") || "",
        id: el.id || "",
        placeholder: el.getAttribute("placeholder") || "",
        text: el.textContent?.trim().slice(0, 100) || "",
        href: el.getAttribute("href") || ""
      };
    }).filter(i => {
      const lower = (i.text + i.placeholder + i.name + i.id + i.href).toLowerCase();
      return lower.includes("phone") || 
             lower.includes("linkedin") || 
             lower.includes("sponsor") || 
             lower.includes("ai tool") || 
             lower.includes("authoriz") ||
             lower.includes("update your profile") ||
             i.text.includes("Exploratory") ||
             i.text.includes("Individual") ||
             i.text.includes("Team") ||
             i.text.includes("Cross-functional");
    });
  });

  console.log("Found relevant application form elements:", JSON.stringify(elements, null, 2));
  await context.close();
}

dumpAllInputsAfterApply().catch(console.error);

