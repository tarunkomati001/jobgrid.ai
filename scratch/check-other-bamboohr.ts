import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function check(url: string) {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log(`Checking ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  console.log(`URL: ${page.url()}`);
  console.log(`Snippet: ${text.slice(0, 300)}`);

  const applyBtn = page.locator("button:has-text('Apply'), a:has-text('Apply'), [role='button']:has-text('Apply')").first();
  const hasApply = await applyBtn.isVisible().catch(() => false);
  console.log(`Has Apply button? ${hasApply}`);

  await browser.close();
}

async function main() {
  await check("https://greenparkcontent.bamboohr.com/careers/831");
  await check("https://prentkeromich.bamboohr.com/careers/526");
  await check("https://prentkeromich.bamboohr.com/careers/527");
  await check("https://atlas.bamboohr.com/careers/604");
}

main().catch(console.error);

