import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function main() {
  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Current Page URL:", page.url());
  const inputs = await page.locator("input:visible").all();
  console.log(`Found ${inputs.length} visible inputs:`);
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    const type = await inp.getAttribute("type").catch(() => "");
    const name = await inp.getAttribute("name").catch(() => "");
    const id = await inp.getAttribute("id").catch(() => "");
    const maxlength = await inp.getAttribute("maxlength").catch(() => "");
    const val = await inp.inputValue().catch(() => "");
    console.log(`  [${i}] type="${type}", name="${name}", id="${id}", maxlength="${maxlength}", val="${val}"`);
  }

  const buttons = await page.locator("button:visible").all();
  console.log(`Found ${buttons.length} visible buttons:`);
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].innerText().catch(() => "");
    console.log(`  button[${i}]: "${text.replace(/\n+/g, ' ')}"`);
  }

  await context.close();
}

main().catch(console.error);

