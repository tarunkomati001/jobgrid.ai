import { chromium } from "playwright";

async function inspectErrorParents() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742", { waitUntil: "networkidle" });

  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "u9m!LLvdS7Bcyqc");
  await page.fill("input[name='cwsPassword_2']", "u9m!LLvdS7Bcyqc");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(2000);

  await page.fill("input[name='firstName']", "Hrutin");
  await page.fill("input[name='lastName']", "Nammi");
  await page.fill("input[name='phone']", "8688423267");
  await page.fill("input[name='address']", "Vadodara");
  await page.fill("input[name='city']", "Vadodara");
  await page.selectOption("select[name='state']", "California");
  await page.fill("input[name='zipCode']", "94105");
  await page.selectOption("select[name='source']", "1");
  await page.selectOption("select[name='legalStatus']", "441");
  await page.selectOption("select[name='CUSTOM_1237']", "1388");

  await page.evaluate(() => {
    const el = document.querySelector("input[name='CUSTOM_1136'][value='853']") as HTMLInputElement;
    if (el) {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  await page.selectOption("select[name='CUSTOM_1138']", "1386");
  await page.fill("textarea[name='CUSTOM_1140']", "N/A");
  await page.selectOption("select[name='CUSTOM_288']", "478");
  await page.fill("input[name='CUSTOM_1238']", "75000");
  await page.fill("input[name='CUSTOM_1239']", "95000");

  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(2000);

  const htmlList = await page.evaluate(() => {
    const errEls = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text"));
    return errEls.filter(e => e.textContent?.includes("Required")).map(e => {
      let p = e.parentElement;
      return p ? p.outerHTML : "NO PARENT";
    });
  });

  for (let i = 0; i < htmlList.length; i++) {
    console.log(`\n--- ERROR ${i+1} CONTAINER ---\n`, htmlList[i]);
  }

  await browser.close();
}

inspectErrorParents().catch(console.error);
