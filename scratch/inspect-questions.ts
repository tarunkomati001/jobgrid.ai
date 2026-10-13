import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectQuestions() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://apply.workable.com/rokt/j/7219AFDA7F/apply/";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  try {
    const cookieBtn = page.locator("button:has-text('Accept'), [data-ui='cookie-consent-accept']").first();
    if (await cookieBtn.count() > 0) await cookieBtn.click();
  } catch (e) {}

  const questions = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll("[data-ui*='question'], [data-ui*='section'], section, form > div, form [class*='section']"));
    
    // Find all elements containing "Will you now" or "sponsorship" or "authorized"
    const allDivs = Array.from(document.querySelectorAll("*")).filter(el => {
      const text = el.textContent || "";
      return text.includes("require sponsorship") && el.children.length < 5 && el.children.length > 0;
    });

    const debugElements = allDivs.slice(0, 5).map(el => ({
      tagName: el.tagName,
      className: el.className,
      outerHTML: el.outerHTML
    }));

    // Find all buttons, radios, checkboxes, selects in the Details section
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], [role='radio'], [role='checkbox'], input[type='radio']")).map(b => ({
      tagName: b.tagName,
      role: b.getAttribute("role"),
      type: (b as any).type,
      text: b.textContent?.trim(),
      dataUi: b.getAttribute("data-ui"),
      ariaChecked: b.getAttribute("aria-checked"),
      ariaPressed: b.getAttribute("aria-pressed"),
      name: (b as any).name,
      value: (b as any).value,
      parentHtml: b.parentElement?.innerHTML.slice(0, 300)
    }));

    return {
      debugElements,
      buttons
    };
  });

  console.log("DEBUG ELEMENTS:", JSON.stringify(questions.debugElements, null, 2));
  console.log("BUTTONS / RADIOS:", JSON.stringify(questions.buttons, null, 2));

  await browser.close();
}

inspectQuestions().catch(console.error);
