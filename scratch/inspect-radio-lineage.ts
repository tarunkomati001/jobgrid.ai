import { chromium } from "playwright";

async function inspectRadioLineage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const radioInfo = await page.evaluate(() => {
    const r = document.querySelector("input[type='radio']");
    if (!r) return null;
    const lineage: any[] = [];
    let cur = r as HTMLElement | null;
    while (cur && cur.tagName !== "FORM") {
      const childrenSummary = Array.from(cur.children).map(c => ({
        tag: c.tagName,
        className: c.className,
        text: (c.textContent || "").slice(0, 60).trim()
      }));
      lineage.push({
        tag: cur.tagName,
        className: cur.className,
        childrenCount: cur.children.length,
        childrenSummary
      });
      cur = cur.parentElement;
    }
    return lineage;
  });

  console.log("Radio lineage on Job 1:", JSON.stringify(radioInfo, null, 2));

  // Also check Job 5 (DVT) radio lineage
  await page.goto("https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const dvtRadioInfo = await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll("input[type='radio']"));
    return radios.slice(0, 3).map(r => {
      // Find question text
      let qText = "";
      // Check fieldset / legend or closest question container
      const fieldset = r.closest("fieldset");
      const legend = fieldset ? fieldset.querySelector("legend")?.textContent : "";
      
      // Check closest div with a label / heading
      let cur = r.parentElement;
      let labelInParent = "";
      for (let i = 0; i < 4 && cur; i++) {
        const lbl = cur.querySelector("label:not(:has(input[type='radio'])), [class*='label'], [class*='title'], [class*='question'], [class*='Legend'], [class*='legend']");
        if (lbl && !lbl.contains(r)) {
          labelInParent = lbl.textContent || "";
          break;
        }
        cur = cur.parentElement;
      }

      return {
        name: (r as HTMLInputElement).name,
        value: (r as HTMLInputElement).value,
        optionLabel: r.closest("label")?.textContent?.trim(),
        legend: legend?.trim(),
        labelInParent: labelInParent.trim().replace(/\s+/g, " ")
      };
    });
  });

  console.log("DVT Radio info:", JSON.stringify(dvtRadioInfo, null, 2));

  await browser.close();
}

inspectRadioLineage().catch(console.error);
