import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function main() {
  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  await page.goto("https://wellfound.com/jobs/signup", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("URL:", page.url());
  const bodyText = await page.locator("body").innerText();
  console.log("Body text snippet:\n", bodyText.slice(0, 500));

  const inputs = await page.locator("input:visible").all();
  console.log(`Found ${inputs.length} visible inputs:`);
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    const type = await inp.getAttribute("type").catch(() => "");
    const name = await inp.getAttribute("name").catch(() => "");
    const id = await inp.getAttribute("id").catch(() => "");
    const maxlength = await inp.getAttribute("maxlength").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`  [${i}] type="${type}", name="${name}", id="${id}", maxlength="${maxlength}", placeholder="${placeholder}"`);
  }

  const buttons = await page.locator("button:visible, input[type='submit']").all();
  console.log(`Found ${buttons.length} buttons:`);
  for (let i = 0; i < buttons.length; i++) {
    const t = await buttons[i].innerText().catch(() => "");
    const v = await buttons[i].getAttribute("value").catch(() => "");
    console.log(`  button[${i}]: text="${t.trim()}", value="${v}"`);
  }

  await page.screenshot({ path: "scratch/current_signup_state.png" });
  await context.close();
}

main().catch(console.error);

