import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008");
  
  await page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first().click();
  await page.waitForTimeout(3000);

  if (page.url().includes("candidateLogin")) {
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.locator("button[name='login'], button:has-text('Login')").first().click();
    await page.waitForTimeout(4000);
  }

  // Select Country: India
  console.log("Selecting country India...");
  await page.selectOption("select[name='country']", { label: "India" }).catch(() => page.selectOption("select[name='country']", "267"));
  await page.waitForTimeout(3000);

  const stateElem = await page.evaluate(() => {
    const el = document.querySelector('[name="state"], #state') as any;
    if (!el) return null;
    return {
      tag: el.tagName,
      type: el.type,
      optionsCount: el.options ? el.options.length : 0,
      options: el.options ? Array.from(el.options).map((o: any) => ({ text: o.text, val: o.value })).slice(0, 15) : undefined,
      gujaratOpt: el.options ? Array.from(el.options).find((o: any) => o.text.toLowerCase().includes("gujarat")) : undefined
    };
  });

  console.log("State element after selecting India:", JSON.stringify(stateElem, null, 2));

  await browser.close();
}

main().catch(console.error);
