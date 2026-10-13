import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const styleInfo = await page.evaluate(() => {
    const styles = Array.from(document.querySelectorAll("style")).map(s => s.innerText).join("\n");
    const lines = styles.split("\n");
    return lines.filter(l => l.includes("#f") && (l.includes("color") || l.includes("background")) && (l.includes("error") || l.includes("banner") || l.includes("alert") || l.includes("notification") || l.includes("danger") || l.includes("warning"))).slice(0, 20);
  });
  console.log("Filtered style rules:", styleInfo);

  await browser.close();
}

test().catch(console.error);
