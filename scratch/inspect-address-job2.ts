import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectAddressJob2() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://apply.workable.com/rokt/j/8C792C8AC9/apply/";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const addr = document.querySelector("#address, input[name='address'], [data-ui='address']");
    const city = document.querySelector("#city, input[name='city']");
    const postcode = document.querySelector("#postcode, input[name='postcode']");
    const country = document.querySelector("#country, input[name='country']");

    return {
      addr: addr ? {
        outerHTML: addr.outerHTML,
        value: (addr as HTMLInputElement).value,
        placeholder: (addr as HTMLInputElement).placeholder,
        parentHTML: addr.parentElement?.outerHTML
      } : null,
      city: city ? { outerHTML: city.outerHTML, value: (city as HTMLInputElement).value } : null,
      postcode: postcode ? { outerHTML: postcode.outerHTML, value: (postcode as HTMLInputElement).value } : null,
      country: country ? { outerHTML: country.outerHTML, value: (country as HTMLInputElement).value } : null,
    };
  });

  console.log("ADDRESS FIELDS JOB 2:\n", JSON.stringify(res, null, 2));
  await browser.close();
}

inspectAddressJob2().catch(console.error);
