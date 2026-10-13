import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectStep1Details() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const step1Html = await page.evaluate(() => {
    const el = document.getElementById("step-01");
    return el ? el.innerHTML : "NOT FOUND";
  });

  fs.writeFileSync(path.resolve(__dirname, "step1_raw.html"), step1Html);
  console.log("Saved step1_raw.html. Length:", step1Html.length);

  // Let's also check all buttons on the page (including Next, Continue, etc.)
  const allButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")).map(b => ({
      tag: b.tagName,
      type: (b as any).type,
      id: b.id,
      name: (b as any).name,
      text: b.textContent?.trim().replace(/\s+/g, " "),
      value: (b as any).value,
      className: b.className,
      onclick: b.getAttribute("onclick")
    })).filter(b => b.text || b.value || b.id);
  });

  console.log("Interactive buttons/links on page:", JSON.stringify(allButtons, null, 2));

  await browser.close();
}

inspectStep1Details().catch(console.error);
