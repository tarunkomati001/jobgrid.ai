import { chromium } from "playwright";

async function inspectTextAndTextarea() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Job 4: Companion Group
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const j4Info = await page.evaluate(`(() => {
    const textareas = Array.from(document.querySelectorAll("textarea"));
    const textInputs = Array.from(document.querySelectorAll("input[type='text']:not([name='candidate.name'])"));
    
    function resolveLabel(el) {
      if (el.id) {
        const l = document.querySelector('label[for="' + el.id + '"]');
        if (l) return { src: 'label[for]', text: (l.textContent || '').trim() };
      }
      const parentLabel = el.parentElement ? el.parentElement.querySelector("label") : null;
      if (parentLabel && parentLabel !== el) {
        return { src: 'parent > label', text: (parentLabel.textContent || '').trim() };
      }
      const fs = el.closest("fieldset");
      if (fs) {
        const leg = fs.querySelector("legend");
        if (leg) return { src: 'fieldset > legend', text: (leg.textContent || '').trim() };
      }
      return { src: 'none', text: '' };
    }

    return {
      textareas: textareas.map(t => ({ id: t.id, name: t.name, label: resolveLabel(t) })),
      textInputs: textInputs.map(t => ({ id: t.id, name: t.name, label: resolveLabel(t) }))
    };
  })()`);

  console.log("Job 4 Text/Textareas:", JSON.stringify(j4Info, null, 2));

  // Job 5: DVT
  await page.goto("https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const j5Info = await page.evaluate(`(() => {
    const textareas = Array.from(document.querySelectorAll("textarea"));
    function resolveLabel(el) {
      if (el.id) {
        const l = document.querySelector('label[for="' + el.id + '"]');
        if (l) return { src: 'label[for]', text: (l.textContent || '').trim() };
      }
      const parentLabel = el.parentElement ? el.parentElement.querySelector("label") : null;
      if (parentLabel && parentLabel !== el) {
        return { src: 'parent > label', text: (parentLabel.textContent || '').trim() };
      }
      const fs = el.closest("fieldset");
      if (fs) {
        const leg = fs.querySelector("legend");
        if (leg) return { src: 'fieldset > legend', text: (leg.textContent || '').trim() };
      }
      return { src: 'none', text: '' };
    }
    return {
      textareas: textareas.map(t => ({ id: t.id, name: t.name, label: resolveLabel(t) }))
    };
  })()`);

  console.log("Job 5 Textareas:", JSON.stringify(j5Info, null, 2));

  await browser.close();
}

inspectTextAndTextarea().catch(console.error);
