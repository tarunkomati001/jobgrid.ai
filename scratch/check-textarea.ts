import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function checkTextarea() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const url = "https://wellfound.com/jobs/3293991-founding-software-engineer";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("[class*='actionBar'] button:has-text('Apply'), [class*='applyButton'], button:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const textareas = await page.locator("textarea").all();
  console.log(`Found ${textareas.length} textarea(s).`);

  for (let i = 0; i < textareas.length; i++) {
    const ta = textareas[i];
    const isVis = await ta.isVisible().catch(() => false);
    const val = await ta.inputValue().catch(() => "");
    const id = await ta.getAttribute("id");
    const name = await ta.getAttribute("name");
    console.log(`Textarea #${i}: id=${id}, name=${name}, isVisible=${isVis}, val="${val}"`);
  }

  await context.close();
}

checkTextarea().catch(console.error);

