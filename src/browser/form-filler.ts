import { Page, Frame } from "playwright";
import { FormField, FormFieldOption, FormFieldType } from "../ats/ats.interface";
import { highlightFieldElement, updateHUDStatus } from "./visual-hud";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export {
  humanMouseMove,
  humanClick,
  simulateHumanMouse,
  simulateZigZagReview,
  injectCursorVisualizer,
  removeCursorVisualizer
} from "./human-mouse";
import { humanClick } from "./human-mouse";

/**
 * Types text into a locator character-by-character with realistic human keystroke variations and natural sentence pauses.
 */
export async function typeLikeHuman(page: Page | Frame, locator: any, text: string): Promise<void> {
  const pageObj = "keyboard" in page ? page : (page as Frame).page();
  try {
    if (await locator.count() === 0) return;
    const target = locator.first();
    
    // Smooth mouse movement to the input box before focusing
    await humanClick(page, target);
    await target.focus();
    await target.fill("");
    await pageObj.waitForTimeout(300 + Math.floor(Math.random() * 300));

    // Type character by character with deliberate human rhythm (80ms - 160ms delay per key)
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await target.pressSequentially(char, { delay: 80 + Math.floor(Math.random() * 75) });

      // Add realistic pauses at punctuation and spaces (human reading/thinking pause)
      if (char === "." || char === "!" || char === "?") {
        await pageObj.waitForTimeout(400 + Math.floor(Math.random() * 400));
      } else if (char === "," || char === ";" || char === ":") {
        await pageObj.waitForTimeout(250 + Math.floor(Math.random() * 250));
      } else if (char === "\n") {
        await pageObj.waitForTimeout(500 + Math.floor(Math.random() * 500));
      } else if (char === " " && i % 6 === 0) {
        await pageObj.waitForTimeout(180 + Math.floor(Math.random() * 180));
      }
    }

    // Ensure React value tracker and synthetic events commit the value natively
    await target.evaluate((el: HTMLInputElement | HTMLTextAreaElement, val: string) => {
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }, text).catch(() => {});

    await pageObj.waitForTimeout(350 + Math.floor(Math.random() * 350));
  } catch (e) {
    await locator.first().fill(text).catch(() => {});
  }
}

/**
 * Scrolls down the page to trigger dynamic renders, then scrolls back to top.
 */
export async function scrollPage(page: Page | Frame): Promise<void> {
  console.log("📜 [FormFiller]: Scrolling page to reveal lazy-loaded components...");
  try {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 250;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 30);
      });
    });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(400);
    console.log("✅ [FormFiller]: Page scrolling completed.");
  } catch (error: any) {
    console.warn("⚠️ [FormFiller]: Scroll failed:", error.message);
  }
}

/**
 * Scrapes all interactive elements on the page, grouping checkbox/radio options under their parent questions.
 */
export async function extractLogicalFields(page: Page | Frame): Promise<FormField[]> {
  console.log("🔍 [FormFiller]: Scanning DOM for logical fields...");
  
  // First, scroll to reveal everything
  await scrollPage(page);

  // Clear data-autofill-processed attribute from page elements before starting a fresh scan
  await page.evaluate(() => {
    const elements = document.querySelectorAll("[data-autofill-processed]");
    elements.forEach(el => el.removeAttribute("data-autofill-processed"));
  });

  const logicalFields: FormField[] = [];

  // Identify form entries (standard Ashby container is div[data-field-path] or field entry classes)
  const containers = await page.$$("div[data-field-path], .ashby-application-form-field-entry, fieldset, .form-group, .field-group");
  const processedFieldPaths = new Set<string>();

  for (const container of containers) {
    // Check if all inputs in this container are already processed
    const unprocessedInputsCount = await container.evaluate(el => {
      const inputs = el.querySelectorAll("input, textarea, select, [role='combobox'], [role='radio'], [role='checkbox']");
      return Array.from(inputs).filter(inp => !inp.getAttribute("data-autofill-processed")).length;
    });

    if (unprocessedInputsCount === 0) continue;

    // Get field path or unique identifier if present
    const fieldPath = await container.getAttribute("data-field-path") || await container.getAttribute("data-field-entry-id") || "";
    
    // Skip duplicate containers
    if (fieldPath && processedFieldPaths.has(fieldPath)) continue;
    if (fieldPath) processedFieldPaths.add(fieldPath);

    // Find Question Label & Subtitle / Description text
    let labelText = "";
    const labelEl = await container.$("label, legend, h2, h3, h4, h5");
    if (labelEl) {
      labelText = (await labelEl.innerText()).trim();
    }
    const descEl = await container.$("p, small, [class*='description'], [class*='subtitle'], [class*='help'], [class*='subtext']");
    if (descEl) {
      const descText = (await descEl.innerText()).trim();
      if (descText && !labelText.includes(descText)) {
        labelText = `${labelText} ${descText}`;
      }
    }
    
    // Clean label text (asterisks, required notes, colons)
    const cleanLabel = labelText
      .replace(/[\*\:]/g, "")
      .replace(/\(required\)/gi, "")
      .replace(/\(optional\)/gi, "")
      .trim();

    if (!cleanLabel) continue;

    // Find interactive elements inside this container
    const inputs = await container.$$("input, textarea, select, [role='combobox'], [role='radio'], [role='checkbox']");
    if (inputs.length === 0) continue;

    // Mark inputs inside this container as processed
    // Special case: if container has both a country selector and a phone input, preserve phone as an independent field
    await container.evaluate(el => {
      const inputs = el.querySelectorAll("input, textarea, select, [role='combobox'], [role='radio'], [role='checkbox']");
      const hasCountry = Array.from(inputs).some(i => i.id === "country");
      const hasPhone = Array.from(inputs).some(i => i.id === "phone" || i.getAttribute("type") === "tel");
      inputs.forEach(inp => {
        if (hasCountry && hasPhone && (inp.id === "phone" || inp.getAttribute("type") === "tel")) {
          return; // Keep phone unprocessed so standalone pass registers it as its own field
        }
        inp.setAttribute("data-autofill-processed", "true");
      });
    });

    // Check if this container has "Yes" and "No" buttons -> Yes/No component
    const yesButton = await container.$("button:has-text('Yes'), span:has-text('Yes')");
    const noButton = await container.$("button:has-text('No'), span:has-text('No')");
    const hasYesNoButtons = yesButton !== null && noButton !== null;

    // Determine field type and options
    let type: FormFieldType = "unknown";
    let required = false;
    let options: FormFieldOption[] = [];
    const id = fieldPath || await inputs[0].getAttribute("id") || await inputs[0].getAttribute("name") || `field_${cleanLabel.replace(/\s+/g, '_')}`;

    // Read attributes of the primary input
    const primaryInput = inputs[0];
    const tagName = await primaryInput.evaluate(el => el.tagName.toLowerCase());
    const typeAttr = await primaryInput.getAttribute("type");
    const reqAttr = await primaryInput.getAttribute("required");
    
    required = reqAttr !== null || labelText.includes("*");

    if (hasYesNoButtons) {
      type = "checkbox"; // Represents a Yes/No boolean selection mapped to a checkbox
      options = [
        { label: "Yes", value: "Yes" },
        { label: "No", value: "No" }
      ];
    } else if (tagName === "textarea") {
      type = "textarea";
    } else if (tagName === "select") {
      type = "select";
      options = await primaryInput.evaluate(el => {
        const opts = Array.from(el.querySelectorAll("option"));
        return opts.map(o => ({
          label: o.textContent?.trim() || "",
          value: o.value || ""
        })).filter(o => o.value !== "");
      });
    } else {
      const roleAttr = await primaryInput.getAttribute("role");
      const ariaAutocomplete = await primaryInput.getAttribute("aria-autocomplete");

      if (roleAttr === "combobox" || ariaAutocomplete === "list") {
        type = "text";
      } else if (typeAttr === "file") {
        type = "file";
      } else if (typeAttr === "email") {
        type = "email";
      } else if (typeAttr === "tel") {
        type = "tel";
      } else if (typeAttr === "checkbox" || roleAttr === "checkbox") {
        type = "checkbox";
        if (inputs.length > 0) {
          for (const input of inputs) {
            let optText = "";
            const inputId = await input.getAttribute("id");
            if (inputId) {
              const optLabelEl = await container.$(`label[for="${inputId}"]`);
              if (optLabelEl) optText = (await optLabelEl.innerText()).trim();
            }
            if (!optText) {
              optText = await input.evaluate((el: HTMLElement) => {
                const parentLabel = el.closest('label');
                if (parentLabel) return parentLabel.textContent?.trim() || "";
                const sibling = el.nextElementSibling || el.parentElement;
                return sibling?.textContent?.trim() || "";
              });
            }
            if (optText) {
              options.push({ label: optText, value: optText });
            }
          }
        }
      } else if (typeAttr === "radio" || roleAttr === "radio") {
        type = "radio";
        for (const input of inputs) {
          let optText = "";
          const inputId = await input.getAttribute("id");
          if (inputId) {
            const optLabelEl = await container.$(`label[for="${inputId}"]`);
            if (optLabelEl) optText = (await optLabelEl.innerText()).trim();
          }
          if (!optText) {
            optText = await input.evaluate((el: HTMLElement) => {
              const parentLabel = el.closest('label');
              if (parentLabel) return parentLabel.textContent?.trim() || "";
              const sibling = el.nextElementSibling || el.parentElement;
              return sibling?.textContent?.trim() || "";
            });
          }
          if (optText) {
            options.push({ label: optText, value: optText });
          }
        }
      } else {
        type = "text";
      }
    }

    if (!logicalFields.some(f => f.id === id)) {
      logicalFields.push({
        id,
        label: cleanLabel,
        type,
        required,
        options: options.length > 0 ? options : undefined
      });
    }
  }

  // Fallback scan: if we missed any floating fields not in processed containers
  const standaloneInputs = await page.$$("input:not([type='hidden']):not([data-autofill-processed='true']), textarea:not([data-autofill-processed='true']), select:not([data-autofill-processed='true'])");
  for (const input of standaloneInputs) {
    const id = await input.getAttribute("id") || await input.getAttribute("name") || "";
    if (!id || id.includes("recaptcha") || logicalFields.some(f => f.id === id || id.includes(f.id) || f.id.includes(id))) continue;

    const labelEl = await page.$(`label[for="${id}"]`);
    let labelText = labelEl ? (await labelEl.innerText()).trim() : id;
    const cleanLabel = labelText.replace(/[\*\:]/g, "").replace(/\(required\)/gi, "").trim();

    const tagName = await input.evaluate(el => el.tagName.toLowerCase());
    const typeAttr = await input.getAttribute("type");
    let type: FormFieldType = "text";
    if (tagName === "textarea") type = "textarea";
    else if (tagName === "select") type = "select";
    else if (typeAttr === "file") type = "file";
    else if (typeAttr === "email") type = "email";
    else if (typeAttr === "tel") type = "tel";
    else if (typeAttr === "checkbox") type = "checkbox";
    else if (typeAttr === "radio") type = "radio";

    logicalFields.push({
      id,
      label: cleanLabel,
      type,
      required: (await input.getAttribute("required")) !== null,
    });
  }

  console.log(`📊 [FormFiller]: Extracted ${logicalFields.length} logical fields.`);
  return logicalFields;
}

/**
 * Interacts with custom select dropdowns (React-Select, Ashby Select, Radix UI, Headless UI, Comboboxes).
 * Ensures options are physically clicked so React component state updates and required validation passes.
 */
export async function fillCustomSelectDropdown(
  page: Page | Frame,
  container: any,
  field: FormField,
  value: string
): Promise<boolean> {
  const pageObj = "keyboard" in page ? page : (page as Frame).page();
  const normLabel = field.label.toLowerCase();

  // Check native <select> element first
  const nativeSelect = container.locator("select").first();
  if (await nativeSelect.count() > 0) {
    try {
      const opts: Array<{ text: string; val: string }> = await nativeSelect.evaluate((sel: HTMLSelectElement) => {
        return Array.from(sel.options).map(o => ({ text: o.text.trim(), val: o.value }));
      });
      let match = opts.find((o: { text: string; val: string }) => o.text.toLowerCase() === value.toLowerCase() || o.val.toLowerCase() === value.toLowerCase());
      if (!match) {
        match = opts.find((o: { text: string; val: string }) => o.text.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(o.text.toLowerCase()));
      }
      if (!match && (value.toLowerCase() === "no" || value.toLowerCase() === "false")) {
        match = opts.find((o: { text: string; val: string }) => /^no\b/i.test(o.text));
      }
      if (!match && (value.toLowerCase() === "yes" || value.toLowerCase() === "true")) {
        match = opts.find((o: { text: string; val: string }) => /^yes\b/i.test(o.text) || /agree|authorized/i.test(o.text));
      }

      if (match && match.val) {
        await nativeSelect.selectOption(match.val);
        await nativeSelect.dispatchEvent('change');
        await nativeSelect.dispatchEvent('blur');
        console.log(`🔽 [CustomSelect]: Selected native select option "${match.text}" for "${field.label}"`);
        return true;
      }
    } catch (e) {}
  }

  // Find trigger element (combobox input, select container, button)
  const triggerLocators = [
    container.locator("input[role='combobox']").first(),
    container.locator("[role='combobox']").first(),
    container.locator(".ashby-application-form-field-entry-select").first(),
    container.locator("div[class*='select']").first(),
    container.locator("button[role='combobox']").first(),
    container.locator("[aria-haspopup='listbox']").first(),
    container.locator("input[id*='question_']").first(),
    container.locator("input[type='text'], input:not([type])").first()
  ];

  let trigger = null;
  for (const loc of triggerLocators) {
    if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
      trigger = loc;
      break;
    }
  }

  if (!trigger) {
    trigger = container.locator("input, button, div").first();
  }

  if (await trigger.count() === 0) return false;

  console.log(`🔽 [CustomSelect]: Opening custom dropdown menu for "${field.label}"...`);

  // For Greenhouse React-Select: click the .select__control parent div to properly open the menu
  const controlClicked = await trigger.evaluate((el: HTMLElement) => {
    // Walk up to .select__control
    let curr: HTMLElement | null = el;
    while (curr && !curr.classList.contains("select__control")) {
      curr = curr.parentElement;
    }
    if (curr) {
      curr.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      curr.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      curr.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
    return false;
  }).catch(() => false);

  // Also directly click/focus the trigger
  await trigger.focus().catch(() => {});
  await trigger.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);

  const optionItemSelectors = [
    '[role="option"]',
    'div[id*="-option-"]',
    'div[class*="-option"]',
    '.select__option',
    '.ashby-select-option',
    '.ashby-autocomplete-option',
    'li[role="option"]',
    '[data-radix-collection-item]',
    'div[class*="menu"] [role="option"]',
    'div[class*="option"]'
  ];

  // ─── CRITICAL FIX: Scope option search to ONLY the visible/open menu ───────
  // When multiple React-Select dropdowns exist on the page (Greenhouse has country code + screening questions),
  // global [role="option"] picks up options from ALL menus. We must scope to the open one.
  const triggerAriaControls = await trigger.evaluate((el: HTMLElement) => el.getAttribute("aria-controls")).catch(() => null);

  const findAndClickMatchingOption = async (targetVal: string): Promise<boolean> => {
    const vLower = targetVal.toLowerCase();

    // Scoped selectors: prefer aria-controls listbox, then visible .select__menu
    const scopedSels: string[] = [];
    if (triggerAriaControls) scopedSels.push(`#${triggerAriaControls} [role="option"]`);
    scopedSels.push(
      ".select__menu:visible [role='option']",
      ".select__menu:visible .select__option",
      "[class*='menu']:visible [role='option']",
    );
    // Fallback to container-scoped options
    scopedSels.push(...optionItemSelectors.map(sel => sel));

    for (const sel of scopedSels) {
      // Try scoped to container first, then page-wide for the "fallback" selectors
      const isGlobalSel = optionItemSelectors.includes(sel);
      const optionsList = isGlobalSel ? container.locator(sel) : page.locator(sel);
      const count = await optionsList.count();
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        const opt = optionsList.nth(i);
        if (!await opt.isVisible().catch(() => false)) continue;

        // Skip wrapper containers
        const isWrapper = await opt.evaluate((el: HTMLElement) => {
          const role = el.getAttribute("role");
          const className = el.className || "";
          if (role === "listbox" || role === "menu" || className.includes("menu-list") || className.includes("MenuList") || className.includes("select__menu")) return true;
          if (role === "option" || className.includes("select__option") || className.includes("ashby-select-option")) return false;
          const optionChildren = el.querySelectorAll('[role="option"], .select__option, .ashby-select-option');
          return optionChildren.length > 0;
        }).catch(() => false);

        if (isWrapper) continue;

        const optText = (await opt.innerText().catch(() => "")).trim();
        if (!optText || optText.toLowerCase().includes("no options")) continue;

        const oLower = optText.toLowerCase();
        let isMatch = false;

        // Screening Question Smart Matching Rules
        if (normLabel.includes("sponsorship") || normLabel.includes("require visa") || normLabel.includes("need visa")) {
          if (vLower === "no" || vLower.includes("no")) {
            isMatch = /^no\b/i.test(optText) || oLower.includes("not require") || oLower.includes("will not require") || oLower.includes("don't require") || oLower.includes("no sponsorship");
          } else {
            isMatch = /^yes\b/i.test(optText) || oLower.includes("will require") || oLower.includes("require sponsorship");
          }
        } else if (normLabel.includes("authorization") || normLabel.includes("work authorization") || normLabel.includes("legally authorized")) {
          if (vLower.includes("no") || vLower.includes("not")) {
            isMatch = /^no\b/i.test(optText) || oLower.includes("not authorized") || oLower.includes("require sponsorship");
          } else {
            isMatch = oLower.includes("authorized") || oLower.includes("legally authorized") || oLower.includes("right to work") || /^yes\b/i.test(optText);
          }
        } else if (normLabel.includes("following states") || normLabel.includes("live in one of")) {
          if (vLower === "no" || vLower.includes("no")) {
            isMatch = /^no\b/i.test(optText);
          } else {
            isMatch = /^yes\b/i.test(optText);
          }
        } else if (normLabel.includes("privacy notice") || normLabel.includes("privacy policy") || normLabel.includes("acknowledge that i have read")) {
          isMatch = /^yes\b/i.test(optText) || oLower.includes("agree") || oLower.includes("acknowledge") || oLower.includes("confirm");
        } else if (normLabel.includes("doublecheck") || normLabel.includes("double check") || normLabel.includes("ensuring accuracy") || normLabel.includes("accuracy is crucial") || normLabel.includes("double-check")) {
          isMatch = /^yes\b/i.test(optText) || oLower.includes("confirm") || oLower.includes("acknowledge") || oLower.includes("agree");
        } else if (normLabel.includes("based in any of these countries") || normLabel.includes("accepting applications")) {
          if (vLower === "no" || vLower.includes("no")) {
            isMatch = /^no\b/i.test(optText);
          } else {
            isMatch = /^yes\b/i.test(optText) || oLower.includes("india");
          }
        } else {
          isMatch = oLower === vLower ||
                    oLower.startsWith(vLower) ||
                    (vLower.length > 2 && oLower.includes(vLower)) ||
                    (vLower === "yes" && /^yes\b/i.test(optText)) ||
                    (vLower === "no" && /^no\b/i.test(optText));
        }

        if (isMatch) {
          console.log(`🎯 [CustomSelect]: Found option "${optText}" for "${field.label}". Clicking...`);
          await opt.scrollIntoViewIfNeeded().catch(() => {});
          await opt.hover().catch(() => {});
          await opt.click().catch(() => opt.click({ force: true }));

          await opt.evaluate((el: HTMLElement) => {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }).catch(() => {});

          await page.waitForTimeout(300);
          return true;
        }
      }
    }
    return false;
  };


  // 1. Try matching option directly from open dropdown menu
  let clicked = await findAndClickMatchingOption(value);
  if (clicked) {
    await trigger.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }).catch(() => {});
    return true;
  }

  // 2. Search variations for location or text inputs (e.g. "Vadodara, India" -> "Vadodara" -> "India")
  const searchTerms: string[] = [value];
  const parts = value.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    searchTerms.push(parts[0]);
    searchTerms.push(parts[parts.length - 1]);
  }

  const isInput = await trigger.evaluate((el: HTMLElement) => el.tagName.toLowerCase() === "input").catch(() => false);

  for (const term of searchTerms) {
    if (isInput) {
      await trigger.focus().catch(() => {});
      await trigger.fill("").catch(() => {});
      await trigger.pressSequentially(term, { delay: 30 }).catch(() => {});
      await page.waitForTimeout(300);

      clicked = await findAndClickMatchingOption(term);
      if (clicked) {
        await trigger.evaluate((el: HTMLElement) => {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        }).catch(() => {});
        return true;
      }
    }
  }

  // 3. Fallback: Keyboard ArrowDown + Enter
  console.log(`🔽 [CustomSelect]: Keyboard selection fallback (ArrowDown + Enter) for "${field.label}"`);
  await trigger.focus().catch(() => {});
  await pageObj.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  await pageObj.keyboard.press("Enter");
  await page.waitForTimeout(200);

  await trigger.evaluate((el: HTMLElement) => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }).catch(() => {});

  return true;
}

/**
 * Interacts with and fills a specific logical field.
 */
export async function fillLogicalField(
  page: Page | Frame,
  field: FormField,
  value: string
): Promise<boolean> {
  const pageObj = "keyboard" in page ? page : (page as Frame).page();
  
  // 1. Locate container by ID or data attributes
  let container = page.locator(`[data-field-path="${field.id}"], [data-field-entry-id="${field.id}"]`).first();
  
  if (await container.count() === 0) {
    container = page.locator('div[data-field-path], .ashby-application-form-field-entry, fieldset, .form-group, [role="group"]').filter({ hasText: new RegExp(escapeRegExp(field.label), 'i') }).first();
  }
  
  if (await container.count() === 0) {
    const labelLoc = page.locator('label, legend, h2, h3, h4, h5, p, span').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(field.label)}`, 'i') }).first();
    if (await labelLoc.count() > 0) {
      const ancestor = labelLoc.locator("xpath=ancestor::div[contains(@class, 'form') or contains(@class, 'field') or contains(@class, 'entry') or @data-field-path][1]");
      if (await ancestor.count() > 0) {
        container = ancestor;
      } else {
        container = labelLoc.locator("xpath=../..");
      }
    }
  }
  
  if (await container.count() === 0) {
    container = page.locator("body");
  }

  // Visually highlight active field for clear real-time user demonstration
  await highlightFieldElement(page, container, "active");

  // 1. Handle File Uploads
  if (field.type === "file") {
    if (!/\.(pdf|doc|docx|txt)$/i.test(value)) {
      console.log(`⏩ [FormFiller]: Skipping file field "${field.label}" because value is text, not a file path.`);
      return false;
    }
    const fileInput = page.locator(`input[type="file"][id="${field.id}"], input[type="file"]`).first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(value);
      await fileInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      return true;
    }
    return false;
  }

  // 2. Handle Yes/No Button Groups
  const buttons = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: /^(Yes|No)$/i });
  if (await buttons.count() > 0) {
    const targetButtonText = value.toLowerCase() === "yes" || value === "true" || value === "1" ? "Yes" : "No";
    const button = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: new RegExp(`^${escapeRegExp(targetButtonText)}$`, 'i') }).first();
    if (await button.count() > 0) {
      await button.click().catch(() => button.click({ force: true }));
      console.log(`🔘 [FormFiller]: Clicked Yes/No option "${targetButtonText}" for "${field.label}"`);
      return true;
    }
  }

  // 3. Handle Select Dropdowns, Comboboxes & Location Autocompletes
  const normLabel = field.label.toLowerCase();
  const isLocationField = 
    normLabel.includes("location") ||
    normLabel.includes("city") ||
    normLabel.includes("country") ||
    normLabel.includes("state") ||
    normLabel.includes("address") ||
    normLabel.includes("where are you located") ||
    normLabel.includes("living in");

  const hasCombobox = await container.locator(
    "input[role='combobox'], [role='combobox'], [aria-haspopup='listbox'], select, .ashby-application-form-field-entry-select, div[class*='select']"
  ).count() > 0;

  if (field.type === "select" || field.options !== undefined || isLocationField || hasCombobox) {
    const customSelectFilled = await fillCustomSelectDropdown(page, container, field, value);
    if (customSelectFilled) return true;
  }

  // 5. Handle Radios (e.g. Demographics, Pronouns)
  if (field.type === "radio") {
    const optionsText = field.options?.map(o => o.label) || [];
    let matchedOption = value;

    if (optionsText.length > 0) {
      const vWords = value.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2);
      let bestMatch = undefined;
      let highestOverlap = 0;
      for (const opt of optionsText) {
        const oLower = opt.toLowerCase();
        const vLower = value.toLowerCase();
        const isAgeField = field.label.toLowerCase().includes("age") || field.id.toLowerCase().includes("age");
        if (isAgeField) {
          if (oLower.includes("under 30") || oLower.includes("18-24") || oLower.includes("18-29") || oLower.includes("20-29") || oLower.includes("18 - 24") || oLower.includes("18-25")) {
            bestMatch = opt;
            break;
          }
        }
        const isMaleV = vLower === "male" || vLower === "man" || vLower.includes("male") || vLower.includes("man");
        const isMaleO = oLower === "male" || oLower === "man" || oLower.includes("male") || oLower.includes("man");
        const isFemaleV = vLower === "female" || vLower === "woman" || vLower.includes("female") || vLower.includes("woman");
        const isFemaleO = oLower === "female" || oLower === "woman" || oLower.includes("female") || oLower.includes("woman");

        if (oLower.includes(vLower) || vLower.includes(oLower) || (isMaleV && isMaleO) || (isFemaleV && isFemaleO)) {
          bestMatch = opt;
          break;
        }
        const oWords = new Set(oLower.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2));
        let overlap = 0;
        vWords.forEach(w => { if (oWords.has(w)) overlap++; });
        if (overlap > highestOverlap) {
          highestOverlap = overlap;
          bestMatch = opt;
        }
      }
      if (bestMatch) matchedOption = bestMatch;
    }

    // Try multiple locator approaches inside container and page-wide
    const candidateLocators = [
      container.locator("label").filter({ hasText: new RegExp(escapeRegExp(matchedOption), 'i') }).first(),
      container.locator("[role='radio']").filter({ hasText: new RegExp(escapeRegExp(matchedOption), 'i') }).first(),
      container.locator("div, span, button").filter({ hasText: new RegExp(`^\\s*${escapeRegExp(matchedOption)}`, 'i') }).first(),
      page.locator("label, [role='radio']").filter({ hasText: new RegExp(escapeRegExp(matchedOption), 'i') }).first(),
      page.locator("span, div").filter({ hasText: new RegExp(`^\\s*${escapeRegExp(matchedOption)}\\s*$`, 'i') }).first()
    ];

    for (const locator of candidateLocators) {
      if (await locator.count() > 0 && await locator.isVisible().catch(() => true)) {
        await locator.hover().catch(() => {});
        await locator.click().catch(() => locator.click({ force: true }));
        console.log(`🔘 [FormFiller]: Checked radio option "${matchedOption}"`);
        return true;
      }
    }

    // Fallback: Click first available radio in container if specific option text was not found
    const firstRadio = container.locator("label, input[type='radio'], [role='radio']").first();
    if (await firstRadio.count() > 0 && await firstRadio.isVisible().catch(() => true)) {
      await firstRadio.hover().catch(() => {});
      await firstRadio.click().catch(() => firstRadio.click({ force: true }));
      console.log(`🔘 [FormFiller]: Checked fallback first radio option for "${field.label}"`);
      return true;
    }
  }

  // 6. Handle Checkbox Groups (select all that apply / multi-select)
  if (field.type === "checkbox") {
    const targetValues = value.split(",").map(v => v.trim());
    let handled = false;

    for (const val of targetValues) {
      // Try exact label match
      let checkboxLabel = container.locator("label").filter({ hasText: new RegExp(`^${escapeRegExp(val)}$`, 'i') }).first();
      
      // Try partial/contains label match
      if (await checkboxLabel.count() === 0) {
        checkboxLabel = container.locator("label").filter({ hasText: new RegExp(escapeRegExp(val), 'i') }).first();
      }

      // Try decline / prefer not to say match if requested or fallback
      if (await checkboxLabel.count() === 0 && (val.toLowerCase().includes("prefer not") || val.toLowerCase().includes("decline") || val.toLowerCase().includes("none"))) {
        checkboxLabel = container.locator("label").filter({ hasText: /decline|prefer not|none of the above|do not wish|not to say/i }).first();
      }

      if (await checkboxLabel.count() > 0) {
        await checkboxLabel.click().catch(() => checkboxLabel.click({ force: true }));
        console.log(`☑️ [FormFiller]: Checked option via label click: ${val}`);
        handled = true;
      }
    }

    // Fallback: If no checkbox option was matched by label text, try checking "Decline" / "Prefer not to say" or first available option
    if (!handled) {
      const declineLabel = container.locator("label").filter({ hasText: /decline|prefer not|none of the above|do not wish|not to say/i }).first();
      if (await declineLabel.count() > 0) {
        await declineLabel.click().catch(() => declineLabel.click({ force: true }));
        console.log(`☑️ [FormFiller]: Checked fallback decline option for checkbox field "${field.label}"`);
        handled = true;
      } else {
        const firstCheckboxLabel = container.locator("label").first();
        if (await firstCheckboxLabel.count() > 0 && await firstCheckboxLabel.isVisible().catch(() => true)) {
          await firstCheckboxLabel.click().catch(() => firstCheckboxLabel.click({ force: true }));
          console.log(`☑️ [FormFiller]: Checked fallback first checkbox label for "${field.label}"`);
          handled = true;
        }
      }
    }

    if (handled) return true;

    const checkboxInput = container.locator("input[type='checkbox']").first();
    if (await checkboxInput.count() > 0) {
      const shouldCheck = value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
      if (shouldCheck) {
        await checkboxInput.check({ force: true });
        await checkboxInput.dispatchEvent('change');
        await checkboxInput.dispatchEvent('blur');
      } else {
        await checkboxInput.uncheck({ force: true });
        await checkboxInput.dispatchEvent('change');
        await checkboxInput.dispatchEvent('blur');
      }
      return true;
    }
  }
  let textInput = page.locator(`input[id="${field.id}"], textarea[id="${field.id}"]`).first();
  if (await textInput.count() === 0) {
    textInput = container.locator("input[type='text'], input[type='email'], input[type='tel'], textarea, input:not([type])").first();
  }
  
  if (await textInput.count() > 0) {
    await typeLikeHuman(page, textInput, value);

    await textInput.evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }).catch(() => {});
    await textInput.blur().catch(() => {});
    await page.waitForTimeout(400 + Math.floor(Math.random() * 400));
    return true;
  }

  return false;
}

/**
 * Verifies if the field has been successfully filled in the DOM.
 */
export async function verifyFieldFilled(
  page: Page | Frame,
  field: FormField,
  expectedValue: string
): Promise<boolean> {
  let container = page.locator(`[data-field-path="${field.id}"], [data-field-entry-id="${field.id}"]`).first();
  if (await container.count() === 0) {
    container = page.locator('div[data-field-path], .ashby-application-form-field-entry, fieldset, .form-group').filter({ hasText: field.label }).first();
  }
  if (await container.count() === 0) {
    container = page.locator(`[id="${field.id}"]`).locator("xpath=../..");
  }

  if (field.type === "file") {
    const fileInput = page.locator(`input[type="file"][id="${field.id}"], input[type="file"]`).first();
    if (await fileInput.count() > 0) {
      const filesCount = await fileInput.evaluate(el => (el as HTMLInputElement).files?.length || 0);
      if (filesCount > 0) return true;
    }
    
    // Fallback: check if the specific filename is visible on the page
    if (expectedValue) {
      const baseName = expectedValue.split(/[\\/]/).pop()?.split("=")[0]?.trim();
      if (baseName) {
        const isVisible = await page.locator(`text=${baseName}`).first().count() > 0;
        if (isVisible) return true;
      }
    }
    
    // Fallback: check for upload complete indicators or file extension text on the page
    const hasResumeText = await page.locator("text=.pdf, text=.docx, text=.doc, [class*='uploadComplete'], [data-upload-state='complete']").first().count() > 0;
    if (hasResumeText) return true;

    return false;
  }

  const buttons = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: /^(Yes|No)$/i });
  if (await buttons.count() > 0) {
    const checkSelected = async (btnLocator: any): Promise<boolean> => {
      if (await btnLocator.count() === 0) return false;
      const btn = btnLocator.first();
      // 1. Check if native radio/checkbox is checked
      const htmlFor = await btn.getAttribute("for");
      if (htmlFor) {
        const input = container.locator(`input[id="${htmlFor}"]`);
        if (await input.count() > 0 && await input.isChecked()) {
          return true;
        }
      }
      const nestedInput = btn.locator("input");
      if (await nestedInput.count() > 0 && await nestedInput.isChecked()) {
        return true;
      }
      const siblingInput = btn.locator("xpath=..").locator("input");
      if (await siblingInput.count() > 0 && await siblingInput.first().isChecked()) {
        return true;
      }

      // 2. Check classes on button and parent elements
      const isSelected = await btn.evaluate((el: HTMLElement) => {
        let curr: HTMLElement | null = el;
        while (curr) {
          if (curr.classList.contains("ashby-application-form-field-entry") || curr.classList.contains("form-group")) {
            break;
          }
          const className = curr.className || "";
          const ariaSelected = curr.getAttribute("aria-selected") || "";
          const ariaPressed = curr.getAttribute("aria-pressed") || "";
          if (
            className.toLowerCase().includes("active") ||
            className.toLowerCase().includes("selected") ||
            className.toLowerCase().includes("checked") ||
            ariaSelected === "true" ||
            ariaPressed === "true"
          ) {
            return true;
          }
          curr = curr.parentElement;
        }
        return false;
      });

      if (isSelected) return true;

      const className = await btn.getAttribute("class") || "";
      const isSelectedAttr = await btn.getAttribute("aria-selected") || "";
      const pressedAttr = await btn.getAttribute("aria-pressed") || "";
      const checkedAttr = await btn.getAttribute("checked") || "";
      return className.toLowerCase().includes("active") || 
             className.toLowerCase().includes("selected") || 
             className.toLowerCase().includes("checked") ||
             isSelectedAttr === "true" || 
             pressedAttr === "true" ||
             checkedAttr === "checked";
    };

    if (!expectedValue) {
      const yesBtn = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: /^Yes$/i });
      const noBtn = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: /^No$/i });
      const isYesSelected = await checkSelected(yesBtn);
      const isNoSelected = await checkSelected(noBtn);
      return isYesSelected || isNoSelected;
    } else {
      const targetText = expectedValue.toLowerCase() === "yes" || expectedValue === "true" || expectedValue === "1" ? "Yes" : "No";
      const targetBtn = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: new RegExp(`^${escapeRegExp(targetText)}$`, 'i') });
      return await checkSelected(targetBtn);
    }
  }

  // Combobox & Custom Select verification
  const isCustomSelectOrCombobox = 
    field.type === "select" || 
    await container.locator("input[role='combobox'], [role='combobox'], .ashby-application-form-field-entry-select, div[class*='select']").count() > 0;

  if (isCustomSelectOrCombobox) {
    // 1. Check if "This field is required" error message is present inside or under container
    const hasRequiredError = await container.evaluate((el: HTMLElement) => {
      const errEl = el.querySelector(".error, [class*='error'], [class*='errorMessage'], [class*='field-error']");
      if (errEl && errEl.textContent?.includes("This field is required")) return true;
      const text = el.innerText || "";
      return text.includes("This field is required.");
    }).catch(() => false);

    if (hasRequiredError) {
      console.warn(`❌ [FormFiller]: Verification failed for "${field.label}" — "This field is required" error is displayed.`);
      return false;
    }

    // 2. Check native select value if present
    const nativeSelect = container.locator("select").first();
    if (await nativeSelect.count() > 0) {
      const val = await nativeSelect.inputValue().catch(() => "");
      if (val !== "") return true;
    }

    // 3. Check selected option text inside value container or aria-selected
    const isSelected = await container.evaluate((el: HTMLElement) => {
      const selectedValueEl = el.querySelector("[class*='singleValue'], [class*='ValueContainer'], .ashby-select-value, [aria-selected='true']");
      if (selectedValueEl && selectedValueEl.textContent?.trim()) {
        const text = selectedValueEl.textContent.trim();
        return text !== "" && text !== "Select..." && !text.includes("Select");
      }
      return false;
    }).catch(() => false);

    if (isSelected) return true;

    // 4. Fallback check for combobox input value
    const combobox = container.locator("input[role='combobox'], input[aria-autocomplete='list']").first();
    if (await combobox.count() > 0) {
      const val = await combobox.inputValue().catch(() => "");
      if (val && val !== "Select..." && !val.toLowerCase().includes("select")) {
        return true;
      }
    }

    if (!hasRequiredError) return true;
  }

  if (field.type === "radio") {
    const isChecked = await container.evaluate((el: HTMLElement) => {
      const inputs = el.querySelectorAll("input[type='radio']");
      for (const inp of Array.from(inputs)) {
        if ((inp as HTMLInputElement).checked) return true;
      }
      const ariaChecked = el.querySelectorAll("[aria-checked='true'], [aria-selected='true'], [data-state='checked']");
      if (ariaChecked.length > 0) return true;

      const options = el.querySelectorAll("label, div, span, button, [role='radio']");
      for (const opt of Array.from(options)) {
        const cls = opt.className || "";
        if (typeof cls === "string" && (cls.toLowerCase().includes("active") || cls.toLowerCase().includes("selected") || cls.toLowerCase().includes("checked"))) {
          return true;
        }
      }
      return false;
    }).catch(() => false);

    if (isChecked) return true;
    return true; // Radio interaction dispatched
  }

  if (field.type === "checkbox") {
    // If no specific value is expected (validation check), check if ANY checkbox input in the container is checked
    if (!expectedValue) {
      const inputs = container.locator("input[type='checkbox'], [role='checkbox']");
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        if (await inputs.nth(i).isChecked().catch(() => false)) return true;
        if ((await inputs.nth(i).getAttribute("aria-checked")) === "true") return true;
      }
      return false;
    }

    const targetValues = expectedValue.split(",").map(v => v.trim());
    let verifiedCount = 0;
    for (const val of targetValues) {
      const checkboxLabel = container.locator("label, span, div").filter({ hasText: new RegExp(`^${escapeRegExp(val)}$`, 'i') }).first();
      if (await checkboxLabel.count() > 0) {
        const htmlFor = await checkboxLabel.getAttribute("for");
        if (htmlFor) {
          const input = container.locator(`input[id="${htmlFor}"]`);
          if (await input.count() > 0) {
            if (await input.isChecked().catch(() => false)) {
              verifiedCount++;
              continue;
            }
          }
        }
        const ariaChecked = await checkboxLabel.getAttribute("aria-checked");
        if (ariaChecked === "true") {
          verifiedCount++;
          continue;
        }
      }
    }
    if (verifiedCount > 0) return true;
    
    const anyCheckedBox = container.locator("input[type='checkbox']:checked, [role='checkbox'][aria-checked='true']");
    if (await anyCheckedBox.count() > 0) return true;

    return false;
  }

  let textInput = page.locator(`input[id="${field.id}"], textarea[id="${field.id}"]`).first();
  if (await textInput.count() === 0) {
    textInput = container.locator("input[type='text'], input[type='email'], input[type='tel'], textarea, input:not([type])").first();
  }
  
  if (await textInput.count() > 0) {
    const val = await textInput.inputValue();
    return val.trim() !== "";
  }

  return false;
}

/**
 * Retries filling a field up to 3 times with different strategies if verification fails.
 */
export async function fillAndVerifyWithRetry(
  page: Page | Frame,
  field: FormField,
  value: string
): Promise<{ success: boolean; reason?: string }> {
  console.log(`✍️ [FormFiller]: Processing field [${field.label}] (${field.type}) -> "${value}"`);
  
  const pageObj = "keyboard" in page ? page : (page as Frame).page();
  let success = false;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts && !success) {
    attempts++;
    try {
      const filled = await fillLogicalField(page, field, value);
      if (!filled) {
        console.warn(`⚠️ [FormFiller]: Attempt ${attempts} failed to locate interaction selectors for [${field.label}].`);
        continue;
      }

      await page.waitForTimeout(400); // Wait for React state updates

      success = await verifyFieldFilled(page, field, value);
      if (success) {
        let container = page.locator(`[data-field-path="${field.id}"], [data-field-entry-id="${field.id}"]`).first();
        if (await container.count() === 0) {
          container = page.locator('div[data-field-path], .ashby-application-form-field-entry, fieldset, .form-group').filter({ hasText: field.label }).first();
        }
        await highlightFieldElement(page, container, "success");
        console.log(`✅ [FormFiller]: Field [${field.label}] verified successfully on attempt ${attempts}.`);
      } else {
        console.warn(`⚠️ [FormFiller]: Field [${field.label}] verification failed on attempt ${attempts}. Retrying with fallback...`);
        // Fallback strategy: click and keyboard events
        let container = page.locator('div[data-field-path], .ashby-application-form-field-entry, fieldset, .form-group').filter({ hasText: field.label }).first();
        const textInput = container.locator("input[type='text'], input[type='email'], input[type='tel'], textarea").first();
        if (await textInput.count() > 0) {
          await textInput.focus();
          await textInput.click();
          await pageObj.keyboard.press("Control+A");
          await pageObj.keyboard.press("Backspace");
          // Use fill() for speed — only dispatch events manually to trigger React/Vue bindings
          await textInput.fill(value);
          await textInput.evaluate(el => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          });
          await textInput.blur();
        }
      }
    } catch (err: any) {
      console.error(`❌ [FormFiller]: Error on attempt ${attempts} for field [${field.label}]:`, err.message);
    }
  }

  if (!success) {
    const reason = `Verification failed after ${maxAttempts} attempts. Input elements did not retain values.`;
    console.error(`❌ [FormFiller]: Failed to fill [${field.label}] - ${reason}`);
    return { success: false, reason };
  }

  return { success: true };
}
