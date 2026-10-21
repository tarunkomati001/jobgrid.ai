import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://chevron.wd5.myworkdayjobs.com/en-US/jobs/job/Bengaluru%2C-Karnataka%2C-India/Subsurface-Hazard-Specialist_R000073525/apply/applyManually");
  await p.waitForTimeout(6000);
  
  const inputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a")).map(i => ({
      tag: i.tagName,
      text: (i as HTMLElement).innerText?.trim() || (i as HTMLInputElement).placeholder,
      autoId: i.getAttribute("data-automation-id"),
      type: (i as HTMLInputElement).type
    })).filter(x => x.autoId || x.text);
  });
  console.log("Chevron auth elements:", JSON.stringify(inputs, null, 2));
  await p.screenshot({ path: "scratch/chevron_auth_loaded.png" });
  await b.close();
}

main();
