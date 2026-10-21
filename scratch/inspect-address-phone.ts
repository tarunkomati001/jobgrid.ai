import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectAddressAndPhone() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://apply.workable.com/rokt/j/7219AFDA7F/apply/";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    // Address container HTML
    const addressInput = document.querySelector("#address, input[name='address'], [data-ui='address']");
    const addressParent = addressInput?.closest("section, div[class*='field'], div[data-ui]") || addressInput?.parentElement;

    // Phone container HTML
    const phoneInput = document.querySelector("input[type='tel'], input[name='phone']");
    const phoneParent = phoneInput?.closest("section, div[class*='field'], div[data-ui]") || phoneInput?.parentElement;

    // Radio group questions HTML
    const radioContainers = Array.from(document.querySelectorAll("input[type='radio']")).map(r => {
      const container = r.closest("[role='radiogroup'], [data-ui*='question'], div[class*='field'], div[class*='styles--']")?.parentElement;
      return {
        name: r.name,
        value: r.value,
        outerHTML: container?.outerHTML?.slice(0, 400)
      };
    });

    return {
      addressHtml: addressParent?.outerHTML?.slice(0, 1000),
      phoneHtml: phoneParent?.outerHTML?.slice(0, 1000),
      radioContainers: radioContainers.slice(0, 6)
    };
  });

  console.log("ADDRESS HTML:\n", res.addressHtml);
  console.log("\nPHONE HTML:\n", res.phoneHtml);
  console.log("\nRADIO CONTAINERS:\n", JSON.stringify(res.radioContainers, null, 2));

  await browser.close();
}

inspectAddressAndPhone().catch(console.error);
