import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectTaleo() {
  const browser = await chromium.launch({
    headless: false, // run headed so we can see what's happening or debug if needed
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4742";
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log(`Page title: ${title}`);
  console.log(`Current URL: ${page.url()}`);

  await page.screenshot({ path: path.resolve(__dirname, "taleo_req_page.png"), fullPage: true });

  // Find apply button
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a")).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().replace(/\s+/g, " ") || "",
      href: (el as HTMLAnchorElement).href || null,
      id: el.id,
      className: el.className
    })).filter(b => b.text.toLowerCase().includes("apply") || (b.href && b.href.toLowerCase().includes("apply")));
  });

  console.log("Apply buttons/links found:", JSON.stringify(buttons, null, 2));

  // Let's click the Apply button
  const applyBtn = page.locator("button:has-text('Apply'), a:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    console.log("Clicking Apply button...");
    await applyBtn.click();
    await page.waitForTimeout(5000);
    console.log(`Post-click URL: ${page.url()}`);
    await page.screenshot({ path: path.resolve(__dirname, "taleo_after_apply_click.png"), fullPage: true });
  }

  // Dump current page structure & inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button")).map(el => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type || null,
      id: el.id,
      name: (el as HTMLInputElement).name || null,
      placeholder: (el as HTMLInputElement).placeholder || null,
      value: (el as HTMLInputElement).value || null,
      labels: Array.from((el as any).labels || []).map((l: any) => l.innerText?.trim())
    }));
  });

  console.log("Inputs found on current page:", JSON.stringify(inputs.slice(0, 30), null, 2));

  await browser.close();
}

inspectTaleo().catch(console.error);
