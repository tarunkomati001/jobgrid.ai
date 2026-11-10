import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function readBody(url: string) {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`\nURL: ${url}`);
  console.log("InnerText:", text.slice(0, 400));
  await browser.close();
}

async function main() {
  await readBody("https://greenparkcontent.bamboohr.com/careers/831");
  await readBody("https://prentkeromich.bamboohr.com/careers/526");
}

main().catch(console.error);

