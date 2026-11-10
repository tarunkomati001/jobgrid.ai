import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectFields() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });

  console.log("Navigating to Helix requisition...");
  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(2000);

  // Step 1: Login / signup
  console.log("On Step 1, filling credentials...");
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006!Secure");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006!Secure");
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(3000);

  console.log("Now on Step 2 (Your Information). Inspecting date inputs...");
  const dateInfo = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, select, textarea")) as HTMLInputElement[];
    return all.map(el => {
      const parent = el.closest("div, p, label, tr, td");
      const label = parent?.innerText?.trim().replace(/\s+/g, " ") || "";
      return {
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        className: el.className,
        placeholder: el.placeholder,
        label: label.substring(0, 80)
      };
    }).filter(x => x.label.toLowerCase().includes("date") || (x.placeholder && x.placeholder.includes("YY")) || x.name.includes("756"));
  });
  console.log("Date fields on Step 2:", JSON.stringify(dateInfo, null, 2));

  // Advance to Step 3
  console.log("Advancing to Step 3...");
  // Fill required fields on Step 2 first to be able to advance
  await page.evaluate(() => {
    const inps = Array.from(document.querySelectorAll("input[type='text'], input[type='email'], textarea")) as HTMLInputElement[];
    for (const inp of inps) {
      if (!inp.value) {
        if (inp.name === "CUSTOM_756" || inp.placeholder === "M/D/YY") {
          inp.value = "11/17/2026";
        } else {
          inp.value = "Test";
        }
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    const sels = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    for (const s of sels) {
      if (!s.value && s.options.length > 1) {
        s.selectedIndex = 1;
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(3000);

  console.log("Now on Step 3 (Resume and Questions). Dumping all text and elements...");
  const step3Data = await page.evaluate(() => {
    const main = document.querySelector("#step-03") || document.body;
    const text = main ? (main as HTMLElement).innerText : "";
    const els = Array.from(document.querySelectorAll("input, textarea, button, a, select")) as HTMLElement[];
    const relevant = els.map(el => {
      const parent = el.closest("div, p, tr, td, label");
      const lbl = parent?.innerText?.trim().replace(/\s+/g, " ") || "";
      return {
        tag: el.tagName,
        type: (el as any).type,
        name: (el as any).name,
        id: el.id,
        className: el.className,
        text: (el.textContent || (el as any).value || "").trim().substring(0, 50),
        parentText: lbl.substring(0, 80)
      };
    }).filter(x => {
      const c = (x.name + " " + x.id + " " + x.className + " " + x.parentText + " " + x.text).toLowerCase();
      return c.includes("resume") || c.includes("cover") || c.includes("attach") || c.includes("upload") || c.includes("file");
    });
    return { text: text.substring(0, 2000), relevant };
  });

  console.log("Step 3 Text Snippet:\n", step3Data.text);
  console.log("Step 3 Relevant Elements:\n", JSON.stringify(step3Data.relevant, null, 2));

  await page.screenshot({ path: "scratch/step3_details.png", fullPage: true });
  await browser.close();
}

inspectFields().catch(console.error);
