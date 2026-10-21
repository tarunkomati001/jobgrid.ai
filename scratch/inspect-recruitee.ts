import { chromium } from "playwright";

async function inspectRecruitee() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const testUrls = [
    "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
    "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
    "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
    "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
  ];

  for (const url of testUrls) {
    console.log(`\n======================================================`);
    console.log(`Testing URL: ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      console.log("Current Page URL:", page.url());
      console.log("Title:", await page.title());

      // If not /c/new, check if there's an apply button
      const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply'), [data-qa='apply-button']").first();
      const hasApply = await applyBtn.count() > 0;
      console.log("Has Apply button?", hasApply);
      if (hasApply) {
        console.log("Apply button text:", await applyBtn.innerText().catch(() => ""));
        const href = await applyBtn.getAttribute("href").catch(() => null);
        console.log("Apply href:", href);
      }

      // Check if we navigate to /c/new or if form is already on page
      let formPageUrl = page.url();
      if (!formPageUrl.includes("/c/new")) {
        const directFormUrl = url.endsWith("/") ? `${url}c/new` : `${url}/c/new`;
        console.log(`Trying direct /c/new URL: ${directFormUrl}`);
        await page.goto(directFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(3000);
        console.log("URL after /c/new:", page.url());
      }

      // Inspect form and all inputs
      const formExists = await page.locator("form").count() > 0;
      console.log("Form exists on /c/new?", formExists);

      // Check form fields
      const fields = await page.$$eval("input, textarea, select, [role='combobox'], [class*='phone'], [class*='country']", els => els.map(e => ({
        tag: e.tagName,
        id: e.id,
        name: (e as HTMLInputElement).name,
        type: (e as HTMLInputElement).type,
        placeholder: (e as HTMLInputElement).placeholder,
        class: e.className,
        ariaLabel: e.getAttribute("aria-label"),
        label: e.closest("label, .field, [class*='field'], [class*='form-group']")?.textContent?.trim()?.slice(0, 80)
      })));

      console.log(`Found ${fields.length} elements. Sample elements:`);
      console.log(JSON.stringify(fields.slice(0, 15), null, 2));

      // Inspect phone and country selector specifically!
      const phoneEls = await page.$$eval("[class*='phone'], [id*='phone'], [name*='phone'], [class*='country'], [id*='country'], [class*='iti']", els => els.map(e => ({
        tag: e.tagName,
        id: e.id,
        name: (e as HTMLInputElement).name,
        class: e.className,
        outerHTML: e.outerHTML.slice(0, 300)
      })));
      console.log("Phone/Country elements:", JSON.stringify(phoneEls, null, 2));

      // Inspect resume / file upload
      const fileEls = await page.$$eval("input[type='file'], [class*='upload'], [class*='dropzone'], [class*='file']", els => els.map(e => ({
        tag: e.tagName,
        id: e.id,
        name: (e as HTMLInputElement).name,
        class: e.className,
        outerHTML: e.outerHTML.slice(0, 300)
      })));
      console.log("File upload elements:", JSON.stringify(fileEls, null, 2));

    } catch (err: any) {
      console.error(`Error inspecting ${url}:`, err.message);
    }
  }

  await browser.close();
}

inspectRecruitee().catch(console.error);
