import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function dumpOptions() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  await page.goto(url, { waitUntil: "networkidle" });

  const selects = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("select")).map(s => {
      let label = "";
      if (s.id) {
        const l = document.querySelector(`label[for='${s.id}']`);
        if (l) label = l.textContent?.trim() || "";
      }
      return {
        id: s.id,
        name: s.name,
        label,
        options: Array.from(s.options).map(o => ({
          text: o.text.trim(),
          value: o.value,
          selected: o.selected
        }))
      };
    });
  });

  fs.writeFileSync(path.resolve(__dirname, "all_selects.json"), JSON.stringify(selects, null, 2));
  console.log("Saved all_selects.json");
  for (const s of selects) {
    console.log(`\nSelect: id='${s.id}' name='${s.name}' label='${s.label}' (${s.options.length} options)`);
    console.log(s.options.slice(0, 10).map(o => `  [${o.value}] ${o.text}`).join("\n"));
  }

  // Also inspect checkboxes
  const checkboxes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input[type='checkbox']")).map(c => {
      const parent = c.parentElement;
      return {
        id: c.id,
        name: c.name,
        value: c.value,
        label: parent ? parent.textContent?.trim() || "" : ""
      };
    });
  });
  console.log("\nCheckboxes:", JSON.stringify(checkboxes, null, 2));

  await browser.close();
}

dumpOptions().catch(console.error);
