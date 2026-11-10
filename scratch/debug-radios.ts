import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://prentkeromich.bamboohr.com/careers/506", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const applyBtn = page.locator("button:has-text('Apply for This Job')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const radioInfo = await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll("input[type='radio'][name*='customQuestionAnswers']"));
    return radios.map(r => ({
      name: r.getAttribute("name"),
      id: r.id,
      outerHTML: r.outerHTML,
      parentHTML: r.parentElement?.outerHTML?.slice(0, 200),
      label: r.closest("label")?.textContent?.trim(),
      nextSiblingText: (r.nextElementSibling as HTMLElement)?.innerText || r.nextSibling?.textContent?.trim()
    }));
  });

  console.log("Radio inspection:", JSON.stringify(radioInfo.slice(0, 4), null, 2));
  await browser.close();
}

main().catch(console.error);

