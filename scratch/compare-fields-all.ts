import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URLS = [
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4790",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4744"
];

async function inspectAll3() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\n================ Job ${i+1}: ${url} ================`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Job Title
    const header = await page.locator("h1, h2, .oracletaleocwsv2-requisition-title").allInnerTexts();
    console.log("Header/Title:", header.join(" | "));

    // Extract all fields in step-02 and step-03
    const fieldSummary = await page.evaluate(() => {
      const getFields = (stepId: string) => {
        const step = document.getElementById(stepId);
        if (!step) return [];
        return Array.from(step.querySelectorAll("input, select, textarea")).map(el => {
          const inp = el as any;
          if (inp.type === "hidden") return null;
          let label = "";
          if (inp.id) {
            const l = document.querySelector(`label[for='${inp.id}']`);
            if (l) label = l.textContent?.trim() || "";
          }
          if (!label && inp.name) {
            const parent = inp.closest(".form-group, tr, td, div");
            if (parent) {
              const l = parent.querySelector("label, .control-label");
              if (l) label = l.textContent?.trim() || "";
            }
          }
          return {
            tag: inp.tagName,
            type: inp.type,
            name: inp.name,
            id: inp.id,
            label: label.replace(/\s+/g, " ")
          };
        }).filter(Boolean);
      };

      return {
        step2: getFields("step-02"),
        step3: getFields("step-03"),
        step4: getFields("step-04")
      };
    });

    console.log(`Step 2 fields (${fieldSummary.step2.length}):`);
    for (const f of fieldSummary.step2) {
      console.log(`  - [${f?.type}] name='${f?.name}' label='${f?.label}'`);
    }
    console.log(`Step 3 fields (${fieldSummary.step3.length}):`);
    for (const f of fieldSummary.step3) {
      console.log(`  - [${f?.type}] name='${f?.name}' label='${f?.label}'`);
    }
  }

  await browser.close();
}

inspectAll3().catch(console.error);
