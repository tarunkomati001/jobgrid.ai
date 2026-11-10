import { chromium } from "playwright";
import fs from "fs";
import tls from "tls";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";

async function fetchTaleoVerificationLink(userEmail: string, timeoutMs = 60000): Promise<string | null> {
  const user = userEmail;
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const startTime = Date.now();

  console.log(`📡 [Taleo Email Listener] Waiting for Taleo email verification link for ${user}...`);

  while (Date.now() - startTime < timeoutMs) {
    const link = await new Promise<string | null>((resolve) => {
      const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
      socket.setEncoding("utf8");
      let buffer = "";
      let step = 0;

      const finish = (result: string | null) => {
        try {
          socket.write("a999 LOGOUT\r\n");
          socket.end();
        } catch (e) {}
        resolve(result);
      };

      socket.on("data", (chunk: string) => {
        buffer += chunk;
        if (step === 0 && buffer.includes("* OK")) {
          step = 1; buffer = "";
          socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
        } else if (step === 1 && buffer.includes("a001 OK")) {
          step = 2; buffer = "";
          socket.write(`a002 SELECT INBOX\r\n`);
        } else if (step === 2 && buffer.includes("a002 OK")) {
          step = 3; buffer = "";
          socket.write(`a003 SEARCH X-GM-RAW "taleo OR Technatomy OR \\\"verify your email\\\" OR \\\"confirm your email\\\""\r\n`);
        } else if (step === 3 && buffer.includes("a003 OK")) {
          const match = buffer.match(/\* SEARCH (.*)\r\n/);
          const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
          if (ids.length === 0) {
            finish(null);
            return;
          }
          const latestId = ids[ids.length - 1];
          step = 4; buffer = "";
          socket.write(`a004 FETCH ${latestId} (BODY[HEADER.FIELDS (DATE)] BODY[TEXT])\r\n`);
        } else if (step === 4 && buffer.includes("a004 OK")) {
          const urlMatch = buffer.match(/href="([^"]*cwsProspectConfirmation[^"]*)"/i)
            || buffer.match(/href="([^"]*DispatcherServlet[^"]*)"/i)
            || buffer.match(/(https:\/\/[^"'\s<]+(?:DispatcherServlet|cwsProspectConfirmation)[^"'\s<]+)/i);

          if (urlMatch && urlMatch[1]) {
            const cleanUrl = urlMatch[1].replace(/&amp;/g, "&");
            finish(cleanUrl);
          } else {
            finish(null);
          }
        } else if (buffer.includes("NO") || buffer.includes("BAD")) {
          finish(null);
        }
      });

      socket.on("error", () => finish(null));
      setTimeout(() => finish(null), 8000);
    });

    if (link) {
      console.log(`🎉 [Taleo Email Listener] Successfully retrieved confirmation link: ${link}`);
      return link;
    }

    console.log(`⏳ [Taleo Email Listener] Waiting for email to arrive...`);
    await new Promise(r => setTimeout(r, 4000));
  }

  return null;
}

async function fillTbeJob(url: string, testName: string) {
  const profile = HRUTIN_BLUEPRINT_PROFILE;
  const userEmail = "babufakemail@gmail.com";
  const userPassword = "TestPass123!@#";

  console.log(`\n======================================================`);
  console.log(`🚀 STARTING TALEO TEST: ${testName}`);
  console.log(`URL: ${url}`);
  console.log(`======================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply')").first();
    if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
      console.log(`[${testName}] Clicking Apply button...`);
      await applyBtn.click();
      await page.waitForTimeout(3000);
    }

    // Step loop (up to 8 steps)
    for (let step = 1; step <= 8; step++) {
      await page.waitForTimeout(2000);
      const currUrl = page.url();
      const currTitle = await page.title();
      console.log(`\n[${testName}] Step ${step} | URL: ${currUrl} | Title: "${currTitle}"`);

      // Check for candidateLogin redirect (existing user)
      if (currUrl.includes("candidateLogin")) {
        console.log(`[${testName}] Existing user login detected. Logging in...`);
        const passInp = page.locator("input[name='cwsPassword']").first();
        if (await passInp.count() > 0) await passInp.fill(userPassword);
        const loginBtn = page.locator("button[name='login'], button:has-text('Login'), input[value='Login']").first();
        if (await loginBtn.count() > 0) await loginBtn.click({ force: true });
        await page.waitForTimeout(4000);
        continue;
      }

      // Check for Email Verification required (e.g. Technatomy, TBE prospect email confirmation)
      if (currUrl.includes("cwsProspectEmailVerification") || currTitle.toLowerCase().includes("email verification")) {
        console.log(`[${testName}] Taleo Email Verification page detected. Fetching confirmation link from Gmail (${userEmail})...`);
        const confirmUrl = await fetchTaleoVerificationLink(userEmail, 60000);
        if (confirmUrl) {
          console.log(`[${testName}] Navigating to confirmation link: ${confirmUrl}`);
          await page.goto(confirmUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(3000);

          const contLink = page.locator("a:has-text('Continue'), button:has-text('Continue')").first();
          if (await contLink.count() > 0 && await contLink.isVisible().catch(() => false)) {
            console.log(`[${testName}] Clicking Continue link on confirmation page...`);
            await contLink.click({ force: true });
            await page.waitForTimeout(3000);
          }
          continue;
        } else {
          console.error(`❌ [${testName}] Failed to receive Taleo confirmation link in time.`);
        }
      }

      // 1. Account Credentials if present
      const emailInp = page.locator("input[name='email']").first();
      if (await emailInp.count() > 0 && await emailInp.isVisible().catch(() => false)) {
        const val = await emailInp.inputValue().catch(() => "");
        if (!val) {
          console.log(`[${testName}] Filling account email: ${userEmail}`);
          await emailInp.fill(userEmail);
        }
      }
      const pass1 = page.locator("input[name='cwsPassword']").first();
      if (await pass1.count() > 0 && await pass1.isVisible().catch(() => false)) {
        await pass1.fill(userPassword);
      }
      const pass2 = page.locator("input[name='cwsPassword_2']").first();
      if (await pass2.count() > 0 && await pass2.isVisible().catch(() => false)) {
        await pass2.fill(userPassword);
      }

      // 2. Personal & Contact Details
      const fn = page.locator("input[name='firstName']").first();
      if (await fn.count() > 0 && await fn.isVisible().catch(() => false)) {
        const val = await fn.inputValue().catch(() => "");
        if (!val) await fn.fill(profile.firstName);
      }
      const ln = page.locator("input[name='lastName']").first();
      if (await ln.count() > 0 && await ln.isVisible().catch(() => false)) {
        const val = await ln.inputValue().catch(() => "");
        if (!val) await ln.fill(profile.lastName);
      }
      const mi = page.locator("input[name='middleInitial'], input[name='middleName']").first();
      if (await mi.count() > 0 && await mi.isVisible().catch(() => false)) {
        const val = await mi.inputValue().catch(() => "");
        if (!val) await mi.fill(profile.middleName || "");
      }
      const phoneInp = page.locator("input[name='phone'], input[name='cellPhone']").first();
      if (await phoneInp.count() > 0 && await phoneInp.isVisible().catch(() => false)) {
        const val = await phoneInp.inputValue().catch(() => "");
        if (!val) await phoneInp.fill("4155552671");
      }
      const addrInp = page.locator("input[name='address'], input[name='address1']").first();
      if (await addrInp.count() > 0 && await addrInp.isVisible().catch(() => false)) {
        const val = await addrInp.inputValue().catch(() => "");
        if (!val) await addrInp.fill("500 Oracle Parkway");
      }
      const cityInp = page.locator("input[name='city']").first();
      if (await cityInp.count() > 0 && await cityInp.isVisible().catch(() => false)) {
        const val = await cityInp.inputValue().catch(() => "");
        if (!val) await cityInp.fill("Los Angeles");
      }
      const zipInp = page.locator("input[name='zipCode']").first();
      if (await zipInp.count() > 0 && await zipInp.isVisible().catch(() => false)) {
        const val = await zipInp.inputValue().catch(() => "");
        if (!val) await zipInp.fill("90001");
      }

      // 3b. Handle "Add Work History" and "Add Education" if present
      const addWorkBtn = page.locator("button:has-text('Add Work History'), a:has-text('Add Work History'), button:has-text('Add Work'), a:has-text('Add Work')").first();
      if (await addWorkBtn.count() > 0 && await addWorkBtn.isVisible().catch(() => false)) {
        console.log(`[${testName}] Detected 'Add Work History' button. Clicking...`);
        await addWorkBtn.click({ force: true });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `scratch/${testName}_work_modal.png` });

        // Log all inputs inside the active modal/form
        const modalFields = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll("input, select, textarea"));
          return els.filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (el as any).type !== "hidden";
          }).map(el => ({
            tag: el.tagName,
            type: (el as any).type,
            name: (el as any).name,
            id: el.id,
            label: el.closest("div, p, label")?.querySelector("label")?.textContent?.trim() || ""
          }));
        });
        console.log(`[${testName}] Work modal visible inputs:`, JSON.stringify(modalFields, null, 2));

        // Fill modal fields
        await page.evaluate((prof) => {
          const inps = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea")) as HTMLInputElement[];
          for (const inp of inps) {
            const r = inp.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || inp.value) continue;
            const lbl = (inp.closest("div, p, label")?.querySelector("label")?.textContent || inp.name || "").toLowerCase();
            if (lbl.includes("employer") || lbl.includes("company")) inp.value = "Jobspring";
            else if (lbl.includes("title") || lbl.includes("position")) inp.value = "Full Stack AI Developer";
            else if (lbl.includes("city")) inp.value = "Los Angeles";
            else if (lbl.includes("state")) inp.value = "CA";
            else if (lbl.includes("supervisor")) inp.value = "Jane Doe";
            else if (lbl.includes("phone")) inp.value = "4155552671";
            else if (lbl.includes("reason")) inp.value = "Career Growth";
            else if (lbl.includes("duties") || lbl.includes("description") || lbl.includes("responsibilit")) inp.value = "Engineered AI agent automation and full stack pipelines.";
            else if (inp.required || lbl.includes("*")) inp.value = "N/A";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }

          // Selects in modal
          const sels = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
          for (const sel of sels) {
            const r = sel.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || (sel.value && sel.value !== "Please select")) continue;
            const lbl = (sel.closest("div, p, label")?.querySelector("label")?.textContent || sel.name || "").toLowerCase();
            if (lbl.includes("from") && lbl.includes("month")) {
              sel.selectedIndex = 1; // January
            } else if (lbl.includes("from") && lbl.includes("year")) {
              const opt = Array.from(sel.options).find(o => o.text.includes("2024"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (lbl.includes("to") && lbl.includes("month")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("present")) || Array.from(sel.options).find(o => o.text.includes("Mar"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (lbl.includes("to") && lbl.includes("year")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("present")) || Array.from(sel.options).find(o => o.text.includes("2026"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (sel.options.length > 1) {
              sel.selectedIndex = 1;
            }
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, profile);

        // Click Save or Add button in modal (supports button, a, and input)
        const savedWork = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")) as HTMLElement[];
          const saveBtn = btns.find(b => {
            const r = b.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const t = (b.textContent || (b as any).value || "").trim().toLowerCase();
            return (t === "save" || t.includes("save work") || t === "done" || t === "add") && !t.includes("draft") && !t.includes("search");
          });
          if (saveBtn) {
            saveBtn.click();
            return (saveBtn.textContent || (saveBtn as any).value || "").trim();
          }
          return null;
        });
        if (savedWork) {
          console.log(`[${testName}] Successfully clicked '${savedWork}' for Work History entry!`);
          await page.waitForTimeout(2500);
        } else {
          console.warn(`[${testName}] Could not find Save button for Work History modal.`);
        }
      }

      // 3c. Handle "Add Education" if present
      const addEduBtn = page.locator("button:has-text('Add Education'), a:has-text('Add Education')").first();
      if (await addEduBtn.count() > 0 && await addEduBtn.isVisible().catch(() => false)) {
        console.log(`[${testName}] Detected 'Add Education' button. Clicking...`);
        await addEduBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Fill modal fields
        await page.evaluate((prof) => {
          const inps = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea")) as HTMLInputElement[];
          for (const inp of inps) {
            const r = inp.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || inp.value) continue;
            const lbl = (inp.closest("div, p, label")?.querySelector("label")?.textContent || inp.name || "").toLowerCase();
            if (lbl.includes("institution") || lbl.includes("school") || lbl.includes("university")) inp.value = "Parul University";
            else if (lbl.includes("degree")) inp.value = "Bachelor of Technology";
            else if (lbl.includes("major")) inp.value = "Computer Science";
            else if (lbl.includes("gpa")) inp.value = "3.8";
            else if (lbl.includes("city")) inp.value = "Los Angeles";
            else if (inp.required || lbl.includes("*")) inp.value = "N/A";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }

          // Selects in modal
          const sels = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
          for (const sel of sels) {
            const r = sel.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || (sel.value && sel.value !== "Please select")) continue;
            const lbl = (sel.closest("div, p, label")?.querySelector("label")?.textContent || sel.name || "").toLowerCase();
            if (lbl.includes("degree")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("bachelor") || o.text.toLowerCase().includes("degree"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (lbl.includes("graduat") || lbl.includes("complete")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("yes"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (sel.options.length > 1) {
              sel.selectedIndex = 1;
            }
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, profile);

        // Click Save in modal (supports button, a, and input)
        const savedEdu = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")) as HTMLElement[];
          const saveBtn = btns.find(b => {
            const r = b.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const t = (b.textContent || (b as any).value || "").trim().toLowerCase();
            return (t === "save" || t.includes("save education") || t === "done" || t === "add") && !t.includes("draft") && !t.includes("search");
          });
          if (saveBtn) {
            saveBtn.click();
            return (saveBtn.textContent || (saveBtn as any).value || "").trim();
          }
          return null;
        });
        if (savedEdu) {
          console.log(`[${testName}] Successfully clicked '${savedEdu}' for Education entry!`);
          await page.waitForTimeout(2500);
        } else {
          console.warn(`[${testName}] Could not find Save button for Education modal.`);
        }
      }
      const selects = await page.evaluate(() => {
        const allSel = Array.from(document.querySelectorAll("select"));
        return allSel.filter(s => {
          const rect = s.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !s.disabled;
        }).map(s => {
          const lbl = s.closest("div, p, label")?.querySelector("label")?.textContent?.trim() || s.name || "";
          return {
            name: s.name,
            id: s.id,
            label: lbl.replace(/\s+/g, " "),
            selectedValue: s.value,
            selectedText: s.options[s.selectedIndex]?.text?.trim() || "",
            options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }))
          };
        });
      });

      for (const sel of selects) {
        const isUnset = !sel.selectedValue || sel.selectedValue === "" || sel.selectedText === "Please select" || sel.selectedText === "--None--";
        if (!isUnset) continue;

        const lLower = (sel.label + " " + sel.name).toLowerCase();
        let targetValue = "";
        let targetText = "";

        // Country
        if (lLower.includes("country")) {
          const match = sel.options.find(o => o.text.toLowerCase() === "united states" || o.text.toLowerCase() === "usa");
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // State
        else if (lLower.includes("state") || lLower.includes("territory")) {
          // Look for US-CA, California, or CA
          const match = sel.options.find(o => o.text.toUpperCase() === "US-CA" || o.text.toLowerCase() === "california" || o.text.toUpperCase() === "CA")
                     || sel.options.find(o => o.text.toUpperCase().includes("US-CA") || o.text.toLowerCase().includes("california"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Source
        else if (lLower.includes("source")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("career") || o.text.toLowerCase().includes("website") || o.text.toLowerCase().includes("indeed") || o.text.toLowerCase().includes("linkedin"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Current Employment
        else if (lLower.includes("current employment") || lLower.includes("employment status")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("actively") || o.text.toLowerCase().includes("employed"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Career Level
        else if (lLower.includes("career level") || lLower.includes("experience level")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("experienced") || o.text.toLowerCase().includes("entry"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Desired Job Type
        else if (lLower.includes("desired job") || lLower.includes("job type")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("full-time") || o.text.toLowerCase().includes("full time"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Desired Position Type
        else if (lLower.includes("position type")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("office") || o.text.toLowerCase().includes("both") || o.text.toLowerCase().includes("onshore"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Willingness to Travel
        else if (lLower.includes("travel")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("25%") || o.text.toLowerCase().includes("no") || o.text.toLowerCase().includes("yes"));
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Month dropdowns (e.g. dateFrom_month, dateTo_month)
        else if (lLower.includes("month")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("jan")) || sel.options[1];
          if (match) { targetValue = match.value; targetText = match.text; }
        }
        // Year dropdowns (e.g. dateFrom_year, dateTo_year)
        else if (lLower.includes("year")) {
          if (lLower.includes("to") || lLower.includes("end")) {
            const match = sel.options.find(o => o.text.toLowerCase().includes("present")) || sel.options.find(o => o.text === "2026") || sel.options[1];
            if (match) { targetValue = match.value; targetText = match.text; }
          } else {
            const match = sel.options.find(o => o.text === "2024") || sel.options[1];
            if (match) { targetValue = match.value; targetText = match.text; }
          }
        }
        // Yes / No custom questions
        else if (sel.options.some(o => o.text.trim().toLowerCase() === "yes") && sel.options.some(o => o.text.trim().toLowerCase() === "no")) {
          let wantYes = true;
          if (
            lLower.includes("former") || lLower.includes("previous") || lLower.includes("relative") ||
            lLower.includes("felony") || lLower.includes("convict") || lLower.includes("sponsorship") ||
            lLower.includes("conflict") || lLower.includes("terminated")
          ) {
            wantYes = false;
          } else if (
            lLower.includes("authorized") || lLower.includes("18") || lLower.includes("drug") ||
            lLower.includes("background") || lLower.includes("citizen") || lLower.includes("eligible")
          ) {
            wantYes = true;
          } else {
            // General custom question default: "No" if asking about affiliations/violations, "Yes" if asking about capability
            wantYes = !lLower.includes("helix") && !lLower.includes("employee") && !lLower.includes("affil");
          }
          const chosenText = wantYes ? "Yes" : "No";
          const match = sel.options.find(o => o.text.trim().toLowerCase() === chosenText.toLowerCase());
          if (match) { targetValue = match.value; targetText = match.text; }
        }

        // Generic fallback for any remaining unset dropdown
        if (!targetValue && sel.options.length > 1) {
          const validOpts = sel.options.filter(o => o.value !== "" && o.text !== "Please select" && o.text !== "--None--");
          if (validOpts.length > 0) {
            const fallback = validOpts[0];
            targetValue = fallback.value;
            targetText = fallback.text;
            console.log(`📢 [${testName}] User Info Needed: Dropdown '${sel.label}'`);
            console.log(`   Options: [${validOpts.map(o => o.text).join(", ")}]`);
            console.log(`   Auto-selecting '${fallback.text}' to satisfy required ATS field.`);
          }
        }

        if (targetValue) {
          await page.evaluate(({ name, id, val }) => {
            const el = (id ? document.getElementById(id) : null) || document.querySelector(`select[name='${name}']`) as HTMLSelectElement;
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, { name: sel.name, id: sel.id, val: targetValue });
          console.log(`✅ [${testName}] Selected '${targetText}' for dropdown: "${sel.label}"`);
        }
      }

      // 4. Fill text inputs / textareas (Work History, Education, Custom text fields)
      await page.evaluate((prof) => {
        const textInputs = Array.from(document.querySelectorAll("input[type='text']:not([readonly]), textarea:not([readonly])")) as HTMLInputElement[];
        for (const inp of textInputs) {
          const rect = inp.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0 || (inp.value && inp.value.trim().length > 0)) continue;

          const name = inp.name || "";
          const lbl = (inp.closest("div, p, label")?.querySelector("label")?.textContent?.trim() || name).toLowerCase();

          if (name.includes("cwsPassword") || name.includes("email")) continue;

          let val = "";
          if (lbl.includes("degree") || name.includes("degree")) val = "Bachelor of Technology";
          else if (lbl.includes("school") || name.includes("school")) val = "Parul University";
          else if (lbl.includes("major") || name.includes("major")) val = "Computer Science";
          else if (lbl.includes("company") || lbl.includes("employer") || name.includes("company")) val = "Jobspring";
          else if (lbl.includes("job title") || lbl.includes("title") || name.includes("jobTitle")) val = "Full Stack AI Developer";
          else if (lbl.includes("salary") || lbl.includes("compensation") || name.includes("salary")) val = "95000";
          else if (lbl.includes("signature") || name.includes("candESignature")) val = prof.firstName + " " + prof.lastName;
          else if (lbl.includes("date") || name.includes("candEsignatureDate")) {
            const d = new Date();
            val = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
          }
          else if (lbl.includes("city")) val = "Los Angeles";
          else if (lbl.includes("department") || lbl.includes("employee name") || lbl.includes("refer")) val = "N/A";
          else if (inp.required || inp.getAttribute("aria-required") === "true" || lbl.includes("*")) val = "N/A";

          if (val) {
            inp.value = val;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }, profile);

      // 5. Resume upload if file input exists
      const fileInp = page.locator("input[type='file']").first();
      if (await fileInp.count() > 0 && await fileInp.isVisible().catch(() => false)) {
        const resumeFile = "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf";
        if (fs.existsSync(resumeFile)) {
          console.log(`[${testName}] Attaching resume PDF: ${resumeFile}`);
          await fileInp.setInputFiles(resumeFile).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }

      // 6. Candidate eSignature (if present on active step)
      const sigInp = page.locator("input[name='candESignature']").first();
      if (await sigInp.count() > 0 && await sigInp.isVisible().catch(() => false)) {
        const val = await sigInp.inputValue().catch(() => "");
        if (!val) {
          console.log(`[${testName}] Signing certification: ${profile.firstName} ${profile.lastName}`);
          await sigInp.fill(`${profile.firstName} ${profile.lastName}`);
        }
      }
      const sigDateInp = page.locator("input[name='candEsignatureDate']").first();
      if (await sigDateInp.count() > 0 && await sigDateInp.isVisible().catch(() => false)) {
        const d = new Date();
        const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
        await sigDateInp.fill(dateStr);
      }

      // 7. Check for Final Submit Button vs Next Step Arrow
      const submitBtn = page.locator("button[type='submit'].btn-primary:has-text('Submit'), button:has-text('Submit Application'), input[value='Submit']").first();
      const isFinalSubmitVisible = (await submitBtn.count() > 0) && (await submitBtn.isVisible().catch(() => false));

      if (isFinalSubmitVisible) {
        console.log(`🎯 [${testName}] Reached final Submit step! Application successfully fully filled.`);
        break;
      }

      // Click Next Wizard Arrow specifically (never jQuery datepicker!)
      const nextArrow = page.locator("a.oracletaleocwsv2-arrow-nav-next:visible, button.oracletaleocwsv2-arrow-nav-next:visible, a.oracletaleocwsv2-btn-arrow-nav.oracletaleocwsv2-arrow-nav-next:visible").first();
      if (await nextArrow.count() > 0 && await nextArrow.isVisible().catch(() => false)) {
        console.log(`[${testName}] Advancing to next wizard step via arrow-nav-next...`);
        await nextArrow.click({ force: true });
        await page.waitForTimeout(3000);
      } else {
        console.log(`[${testName}] No next arrow visible. Checking submit or end state...`);
        break;
      }
    }

    console.log(`\n🎉 [${testName}] Final Step Reached:`);
    console.log(`Final URL: ${page.url()}`);
    console.log(`Final Title: ${await page.title()}`);
    await page.screenshot({ path: `scratch/${testName}_result.png`, fullPage: true });

  } catch (err: any) {
    console.error(`❌ [${testName}] Error: ${err.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  // Test 1: Helix ESG
  await fillTbeJob(
    "https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023",
    "helix_esg"
  );

  // Test 2: Technatomy
  await fillTbeJob(
    "https://phe.tbe.taleo.net/phe02/ats/careers/v2/viewRequisition?org=TECHNATOMY&cws=38&rid=2771",
    "technatomy"
  );
}

main().catch(console.error);
