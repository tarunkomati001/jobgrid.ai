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

  // Address
  await page.fill("input[name='address']", "ava street");
  // City
  await page.fill("input[name='city']", "vadodar");
  // Zip
  await page.fill("input[name='zipCode']", "390144");

  // Check Country dropdown
  const countrySelect = page.locator("select[name='country']");
  if (await countrySelect.count() > 0) {
    console.log("Selecting Country: India");
    // Select by value 267 or label India
    await countrySelect.selectOption({ label: "India" }).catch(async () => {
      await countrySelect.selectOption("267");
    });
    await page.waitForTimeout(2000);
  }

  // Check State element
  const stateElem = await page.evaluate(() => {
    const el = document.querySelector('[name="state"], #state') as any;
    if (!el) return null;
    return {
      tagName: el.tagName,
      type: el.type,
      options: el.options ? Array.from(el.options).map((o: any) => ({ text: o.text, val: o.value })) : null
    };
  });

  console.log("State element after country select:", JSON.stringify(stateElem, null, 2));

  await page.screenshot({ path: "scratch/address_test.png", fullPage: true });
  console.log("Saved screenshot to scratch/address_test.png");

  await browser.close();
}

main().catch(console.error);
