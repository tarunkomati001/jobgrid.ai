import { chromium } from "playwright";

async function deepInspectRecruitee() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const urls = [
    "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
    "https://zeromotorcycles.recruitee.com/o/legal-counsel",
    "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator",
    "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
    "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
    "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
  ];

  for (const url of urls) {
    console.log("\n=======================================================");
    console.log("Analyzing:", url);
    const formUrl = url.endsWith("/c/new") ? url : `${url.replace(/\/$/, "")}/c/new`;
    try {
      await page.goto(formUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);

      // Check title and company
      const pageTitle = await page.title();
      console.log("Page Title:", pageTitle);

      // Check all questions/fields in the form
      const questions = await page.evaluate(() => {
        const results: any[] = [];
        // Look for form field groups
        const form = document.querySelector("form");
        if (!form) return [{ error: "No form found" }];

        const fieldWrappers = document.querySelectorAll("[class*='sc-'], .field, .form-group, [data-qa]");
        // Let's iterate all inputs, selects, textareas
        const inputs = Array.from(form.querySelectorAll("input, textarea, select, button[aria-haspopup='listbox']"));
        for (const input of inputs) {
          const id = input.id;
          const name = (input as HTMLInputElement).name;
          const type = (input as HTMLInputElement).type || input.tagName.toLowerCase();
          
          // Find surrounding label
          let label = "";
          if (id) {
            const labelEl = document.querySelector(`label[for="${id}"]`);
            if (labelEl) label = labelEl.textContent || "";
          }
          if (!label) {
            const parentLabel = input.closest("label");
            if (parentLabel) label = parentLabel.textContent || "";
          }
          if (!label) {
            let cur = input.parentElement;
            for (let i = 0; i < 4 && cur; i++) {
              const lbl = cur.querySelector("label, [class*='label'], [class*='title'], [class*='question']");
              if (lbl && lbl !== input) {
                label = lbl.textContent || "";
                break;
              }
              cur = cur.parentElement;
            }
          }

          results.push({
            tag: input.tagName,
            type,
            name,
            id,
            label: label.trim().replace(/\s+/g, " "),
            placeholder: (input as HTMLInputElement).placeholder || ""
          });
        }
        return results;
      });

      console.log(`Extracted ${questions.length} elements from ${url}:`);
      console.log(JSON.stringify(questions, null, 2));

    } catch (e: any) {
      console.error("Error analyzing:", e.message);
    }
  }

  // Now let's test specifically opening the Country Code selector on one page
  console.log("\n=======================================================");
  console.log("Testing Country Code selector interaction on Zero Motorcycles...");
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Find country button
  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  console.log("Country button count:", await countryBtn.count());
  if (await countryBtn.count() > 0) {
    console.log("Country button text:", await countryBtn.innerText());
    console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));

    await countryBtn.click();
    await page.waitForTimeout(1000);

    // See what appeared in the DOM
    const dropdownHtml = await page.evaluate(() => {
      // Look for listbox or popover
      const listbox = document.querySelector("[role='listbox'], ul[id*='country'], div[id*='country'], [class*='listbox']");
      if (listbox) {
        return {
          tag: listbox.tagName,
          id: listbox.id,
          class: listbox.className,
          role: listbox.getAttribute("role"),
          itemsCount: listbox.querySelectorAll("[role='option'], li").length,
          sampleItems: Array.from(listbox.querySelectorAll("[role='option'], li")).slice(0, 10).map(e => e.textContent?.trim()),
          searchInputs: Array.from(listbox.querySelectorAll("input")).map(i => ({ id: i.id, placeholder: i.placeholder, class: i.className }))
        };
      }
      // Check all inputs that might have appeared for searching
      const allNewInputs = Array.from(document.querySelectorAll("input[type='search'], input[type='text']:focus, [role='combobox']")).map(i => ({
        id: i.id,
        placeholder: (i as HTMLInputElement).placeholder,
        class: i.className
      }));
      return { listbox: null, allNewInputs };
    });
    console.log("Dropdown after click:", JSON.stringify(dropdownHtml, null, 2));
  }

  await browser.close();
}

deepInspectRecruitee().catch(console.error);
