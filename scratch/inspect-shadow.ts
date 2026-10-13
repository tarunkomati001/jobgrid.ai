import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectShadow() {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(5000);

  // Check spl-input structure
  const splInputDetails = await page.evaluate(() => {
    const splInputs = Array.from(document.querySelectorAll("spl-input, spl-textarea, spl-button, spl-autocomplete"));
    return splInputs.map(el => {
      const shadow = el.shadowRoot;
      const innerHtml = shadow ? shadow.innerHTML : el.innerHTML;
      const shadowInputs = shadow ? Array.from(shadow.querySelectorAll("input, textarea, button")).map(i => ({
        tag: i.tagName,
        id: i.id,
        name: (i as any).name,
        type: (i as any).type,
        placeholder: (i as any).placeholder,
        className: i.className
      })) : [];
      return {
        tag: el.tagName,
        id: el.id,
        label: el.getAttribute("label"),
        hasShadow: !!shadow,
        shadowMode: (shadow as any)?.mode,
        shadowInputs,
        innerSnippet: innerHtml.slice(0, 300)
      };
    });
  });

  console.log("Found spl components:", JSON.stringify(splInputDetails, null, 2));
  await browser.close();
}

inspectShadow().catch(console.error);
