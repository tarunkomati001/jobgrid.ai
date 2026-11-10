import { chromium } from "playwright";
import { createBrowser, createPersistentBrowserContext, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectUrl(url: string) {
  console.log(`\n======================================================`);
  console.log(`🔍 Inspecting BambooHR URL: ${url}`);
  console.log(`======================================================`);

  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log(`Title: ${title}`);

    // Check if there is an "Apply" button or if form is directly visible
    const applyButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"));
      return btns
        .filter(b => /apply/i.test(b.textContent || "") || /apply/i.test(b.getAttribute("href") || ""))
        .map(b => ({
          tag: b.tagName,
          text: (b.textContent || "").trim(),
          href: b.getAttribute("href"),
          id: b.id,
          className: b.className
        }));
    });
    console.log("Apply buttons detected:", applyButtons);

    // If an Apply button exists and form inputs are not visible, click the Apply button
    const hasFormInputs = (await page.locator("input[type='text'], input[type='email'], input[name*='name']").count()) > 0;
    console.log(`Form inputs immediately visible? ${hasFormInputs}`);

    if (!hasFormInputs && applyButtons.length > 0) {
      console.log("Clicking apply button to open application form...");
      const applyBtn = page.locator("button:has-text('Apply for This Job'), a:has-text('Apply for This Job'), button:has-text('Apply'), a:has-text('Apply')").first();
      if (await applyBtn.isVisible().catch(() => false)) {
        await applyBtn.click().catch(() => {});
        await page.waitForTimeout(3000);
      }
    }

    // Now inspect all form fields and inputs
    const formInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
      const fields = inputs.map(el => {
        const tag = el.tagName.toLowerCase();
        const type = (el.getAttribute("type") || tag).toLowerCase();
        const name = el.getAttribute("name") || "";
        const id = el.id || "";
        const placeholder = el.getAttribute("placeholder") || "";
        const ariaLabel = el.getAttribute("aria-label") || "";
        const isRequired = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";

        // Find label
        let label = "";
        const parentLabel = el.closest("label");
        if (parentLabel) {
          label = parentLabel.textContent || "";
        } else if (id) {
          const l = document.querySelector(`label[for="${id}"]`);
          if (l) label = l.textContent || "";
        }
        if (!label) {
          // Look at closest form group or parent container
          const group = el.closest(".BambooHR-form-field, .form-group, div[class*='field'], div[class*='Field'], div[class*='group'], div[class*='Group']");
          if (group) {
            const l = group.querySelector("label, span[class*='label'], div[class*='label']");
            if (l) label = l.textContent || "";
          }
        }

        let options: string[] = [];
        if (tag === "select") {
          options = Array.from((el as HTMLSelectElement).options).map(o => o.text.trim());
        }

        return {
          tag,
          type,
          name,
          id,
          label: label.replace(/\s+/g, " ").trim(),
          placeholder,
          ariaLabel,
          isRequired,
          options
        };
      });

      // Also check custom dropdowns or radio groups
      const customSelects = Array.from(document.querySelectorAll("[role='combobox'], [role='listbox'], [class*='select']")).map(el => ({
        tag: el.tagName,
        className: el.className,
        text: (el.textContent || "").slice(0, 50).trim()
      }));

      // Check submit buttons
      const submitButtons = Array.from(document.querySelectorAll("button[type='submit'], button, input[type='submit']"))
        .filter(b => /submit|apply|send/i.test(b.textContent || "") || /submit/i.test(b.getAttribute("type") || ""))
        .map(b => ({
          tag: b.tagName,
          text: (b.textContent || "").trim(),
          type: b.getAttribute("type"),
          className: b.className
        }));

      return {
        fieldCount: fields.length,
        fields,
        customSelects: customSelects.slice(0, 5),
        submitButtons
      };
    });

    console.log(`\n📋 BambooHR Form Analysis:`);
    console.log(`Total fields found: ${formInfo.fieldCount}`);
    for (const f of formInfo.fields) {
      console.log(`  - [${f.type}] Name: "${f.name}", ID: "${f.id}", Label: "${f.label}", Req: ${f.isRequired}, Placeholder: "${f.placeholder}"${f.options.length ? ` Options: [${f.options.slice(0, 4).join(", ")}...]` : ""}`);
    }
    console.log("\nSubmit buttons:", formInfo.submitButtons);

  } catch (err: any) {
    console.error("Error inspecting:", err.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  await inspectUrl("https://atlas.bamboohr.com/careers/633");
  await inspectUrl("https://headspin.bamboohr.com/careers/331");
  await inspectUrl("https://prentkeromich.bamboohr.com/careers/506");
}

main().catch(console.error);

