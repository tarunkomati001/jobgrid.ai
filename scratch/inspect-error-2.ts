import { chromium } from "playwright";

async function inspectError2() {
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

  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(2000);

  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".text-danger, .oracletaleocwsv2-error-text")).map(e => ({
      text: e.textContent?.trim(),
      id: e.id,
      for: e.getAttribute("for"),
      parentClass: e.parentElement?.className,
      grandParentClass: e.parentElement?.parentElement?.className
    })).filter(e => e.text && e.text.includes("Required"));
  });

  console.log("All required errors:", JSON.stringify(errors, null, 2));

  await browser.close();
}

inspectError2().catch(console.error);
