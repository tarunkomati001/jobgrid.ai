import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";
import path from "path";

async function diagnose() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 900 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://recruiting.paylocity.com/Recruiting/jobs/Apply/3873766";
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(async () => {
    console.log("networkidle timed out, proceeding...");
  });

  await page.waitForTimeout(4000);

  // Check if cookie popup exists
  const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies'), #accept-recommended-btn-handler").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Clicking cookie accept button...");
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Check frames
  const frames = page.frames();
  console.log(`Total frames: ${frames.length}`);
  for (let i = 0; i < frames.length; i++) {
    console.log(`Frame ${i}: name="${frames[i].name()}" url="${frames[i].url()}"`);
  }

  const html = await page.content();
  fs.writeFileSync("scratch/paylocity_apply_page.html", html);
  console.log(`Saved HTML (${html.length} bytes) to scratch/paylocity_apply_page.html`);

  const screenshot = "scratch/paylocity_apply_diagnose.png";
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(`Saved screenshot to ${screenshot}`);

  // Check all visible elements with text or inputs
  const elements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, select, textarea, button, h1, h2, h3, h4, p, label"));
    return all.map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name || "",
      text: (el.textContent || (el as any).value || "").trim().slice(0, 100),
      type: (el as any).type || "",
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(e => e.visible || e.tag === "INPUT" || e.tag === "SELECT" || e.tag === "TEXTAREA");
  });

  console.log("Elements found:", elements.length);
  fs.writeFileSync("scratch/paylocity_elements.json", JSON.stringify(elements, null, 2));

  await browser.close();
}

diagnose().catch(console.error);
