import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://cdcn.avature.net/careers/Register?jobId=8611", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button, input[type='submit'], a.button, a.btn, input[type='button']")).map(b => ({
        tagName: b.tagName,
        id: b.id,
        name: (b as any).name,
        type: (b as any).type,
        text: (b as HTMLElement).innerText?.trim() || (b as any).value || "",
        className: b.className
      }));
    });
    console.log("BUTTONS:", JSON.stringify(buttons, null, 2));

    // Also inspect the form action and method
    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("form")).map(f => ({
        id: f.id,
        name: f.name,
        action: f.action,
        method: f.method,
        className: f.className
      }));
    });
    console.log("FORMS:", JSON.stringify(forms, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
