import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

const urls = [
  "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4616387",
  "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4585012",
  "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597",
  "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4358710"
];

async function inspectJob(url: string, index: number) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    let targetUrl = url;
    if (targetUrl.toLowerCase().includes("/details/")) {
      const match = targetUrl.match(/details\/(\d+)/i);
      if (match) {
        targetUrl = `https://recruiting.paylocity.com/Recruiting/jobs/Apply/${match[1]}`;
      }
    }

    console.log(`\n======================================================`);
    console.log(`[Job ${index + 1}] Target URL: ${targetUrl} (Original: ${url})`);
    console.log(`======================================================`);

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);

    // Dismiss cookies
    const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first();
    if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    const currentUrl = page.url();
    const title = await page.title();
    console.log(`Loaded URL: ${currentUrl}`);
    console.log(`Title: ${title}`);

    // If redirected to details or something, check if there's an apply button
    const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first();
    if (!currentUrl.toLowerCase().includes("/apply/") && await applyBtn.count() > 0) {
      console.log(`Clicking Apply button on details page...`);
      await applyBtn.click().catch(() => {});
      await page.waitForTimeout(4000);
    }

    // Inspect step info
    const stepText = await page.locator("p:has-text('Step'), [class*='step']").allInnerTexts().catch(() => []);
    console.log(`Step indicators:`, stepText.slice(0, 3));

    // Extract all inputs on Step 1
    const inputsInfo = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("input, select, textarea, div[role='combobox'], div.rw-dropdownlist"));
      return els.map((el: any) => {
        const id = el.id || "";
        const name = el.name || "";
        const dataFor = el.getAttribute("data-for") || el.getAttribute("data-automation-id") || "";
        const role = el.getAttribute("role") || "";
        const type = role === "combobox" ? "combobox" : (el.type || el.tagName.toLowerCase());
        const parent = el.closest(".form-group, fieldset, div[class*='group'], div[class*='card']");
        const label = parent ? (parent.querySelector("label, legend, p")?.textContent?.trim() || "") : "";
        const value = el.value || "";
        return { id, name, dataFor, role, type, label, value };
      }).filter(i => i.id || i.dataFor || i.label);
    });

    console.log(`Total fields found on initial step: ${inputsInfo.length}`);
    inputsInfo.forEach(f => {
      console.log(`  - [${f.type}] id="${f.id}" dataFor="${f.dataFor}" label="${f.label}"`);
    });

  } catch (err: any) {
    console.error(`Error on Job ${index + 1}:`, err.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  for (let i = 0; i < urls.length; i++) {
    await inspectJob(urls[i], i);
  }
}

run().catch(console.error);
