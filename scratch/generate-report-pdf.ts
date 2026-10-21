import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function generatePdf() {
  console.log("📄 Generating ATS Root-Cause Analysis PDF...");

  const ashbyImgPath = path.resolve(__dirname, "../screenshots/worker_error_1787910326841.png");
  const greenhouseImgPath = path.resolve(__dirname, "../screenshots/greenhouse-v2-1788436070857.png");

  let ashbyBase64 = "";
  let greenhouseBase64 = "";

  if (fs.existsSync(ashbyImgPath)) {
    ashbyBase64 = `data:image/png;base64,${fs.readFileSync(ashbyImgPath).toString("base64")}`;
  }
  if (fs.existsSync(greenhouseImgPath)) {
    greenhouseBase64 = `data:image/png;base64,${fs.readFileSync(greenhouseImgPath).toString("base64")}`;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ATS Final Submission Issue: Root-Cause Analysis & Solutions</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-size: 9pt;
        color: #888;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.55;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      color: #0f172a;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 6px;
    }
    .meta {
      font-size: 9.5pt;
      color: #64748b;
      margin-bottom: 24px;
      display: flex;
      gap: 20px;
    }
    h2 {
      font-size: 14pt;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    p, li {
      color: #334155;
    }
    ul, ol {
      margin-top: 6px;
      margin-bottom: 12px;
      padding-left: 22px;
    }
    li {
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 20px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .badge-error {
      display: inline-block;
      background-color: #fee2e2;
      color: #991b1b;
      font-size: 8.5pt;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge-warning {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      font-size: 8.5pt;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge-success {
      display: inline-block;
      background-color: #dcfce7;
      color: #166534;
      font-size: 8.5pt;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .callout {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin: 14px 0;
      font-size: 10pt;
    }
    .callout-warning {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin: 14px 0;
      font-size: 10pt;
    }
    code {
      font-family: Consolas, Monaco, "Courier New", monospace;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 9pt;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 8.5pt;
      line-height: 1.4;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    .page-break {
      page-break-before: always;
    }
    .img-container {
      margin: 12px 0;
      text-align: center;
      page-break-inside: avoid;
    }
    .img-container img {
      max-width: 95%;
      max-height: 280px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }
    .img-caption {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 5px;
      font-style: italic;
    }
  </style>
</head>
<body>

  <h1>ATS Final Submission Issue: Root-Cause Analysis & Technical Solutions</h1>
  <div class="meta">
    <span><strong>Scope:</strong> Ashby, Greenhouse, Lever</span> &bull; 
    <span><strong>Date:</strong> March 2026</span> &bull; 
    <span><strong>Author:</strong> Cluco.ai Core Engineering</span>
  </div>

  <h2>1. Executive Summary</h2>
  <p>
    Across all three major Applicant Tracking Systems (<strong>Ashby</strong>, <strong>Greenhouse</strong>, and <strong>Lever</strong>), automated form-filling successfully populates input fields, but final submission consistently fails at the final submit step.
  </p>
  <p>
    Thorough technical inspection of browser network payloads, DOM events, backend queues, and runtime screenshots reveals that failures occur due to <strong>three structural layers</strong>:
  </p>
  <ul>
    <li><strong>Anti-Bot Telemetry at Click Time:</strong> ATS platforms delay anti-bot challenges until the submit event. Google reCAPTCHA Enterprise (Ashby), Cloudflare Turnstile (Greenhouse), and hCaptcha (Lever) detect automation signatures and reject the payload.</li>
    <li><strong>Client-Side Framework State Desynchronization:</strong> Inputs appear filled, but React/Vue internal state remains empty because synthetic events (<code>change</code>, <code>blur</code>) were not triggered, silently halting submission.</li>
    <li><strong>Codebase Execution & Environment Bugs:</strong> Inverted <code>DRY_RUN</code> checks, missing <code>submit()</code> calls in scripts, and worker whitelist filters inadvertently abort submission.</li>
  </ul>

  <h2>2. Failure Summary Matrix</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 14%;">ATS</th>
        <th style="width: 28%;">Primary Root Cause</th>
        <th style="width: 28%;">Observed Failure Symptom</th>
        <th style="width: 30%;">Core Solution</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Ashby</strong></td>
        <td><strong>reCAPTCHA Enterprise Invisible Scoring:</strong> Playwright automation flags produce a low score (&lt;0.5), triggering spam filters.</td>
        <td><span class="badge-error">Flagged as Spam</span><br/><em>"We couldn't submit your application. Your application submission was flagged as possible spam."</em></td>
        <td>Persistent Google Chrome profile + Residential/ISP proxy + 3-5s Bezier mouse review dwell before submit click.</td>
      </tr>
      <tr>
        <td><strong>Greenhouse</strong></td>
        <td><strong>React-Select & Synthetic Event Desync:</strong> Internal React state un-updated on required dropdowns; Cloudflare Turnstile rejection.</td>
        <td><span class="badge-warning">Validation Block</span><br/><em>"This field is required"</em> (under filled dropdowns) or <em>"There was an error processing your application."</em></td>
        <td>Scope dropdown options via <code>aria-controls</code> listbox IDs + smooth scroll to Turnstile + automated email OTP listener.</td>
      </tr>
      <tr>
        <td><strong>Lever</strong></td>
        <td><strong>Interactive hCaptcha Puzzle + DRY_RUN Bug:</strong> Visual captcha halts headless mode; <code>DRY_RUN !== 'false'</code> skips submit.</td>
        <td><span class="badge-error">Captcha Timeout / Skipped</span><br/>90s hCaptcha timeout in headless mode; Lever omitted from background worker.</td>
        <td>Automated CAPTCHA token injection (CapSolver) + Fix <code>DRY_RUN === 'true'</code> + Add Lever to worker queue whitelist.</td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <h2>3. Platform Deep Dives</h2>

  <h3>A. Ashby ATS</h3>
  <p><strong>Mechanisms & Evidence:</strong></p>
  <ul>
    <li><strong>reCAPTCHA Enterprise Invisible Token Verification:</strong> Ashby calls <code>grecaptcha.enterprise.execute()</code> upon clicking <em>Submit Application</em>. Playwright's default environment lacks Google session cookies and triggers bot heuristics. Ashby's backend rejects the payload with HTTP 400/403.</li>
    <li><strong>3 Applications per 60 Days Limit:</strong> Ashby enforces a hard ceiling of 3 submissions per candidate per company over 60 days. Subsequent attempts fail at the API level.</li>
    <li><strong>Async Resume Parser Conflict:</strong> An asynchronous background parser modifies input fields upon file upload. If submit occurs concurrently, validation schema checks fail.</li>
  </ul>

  ${ashbyBase64 ? `
  <div class="img-container">
    <img src="${ashbyBase64}" alt="Ashby Spam Error Screenshot" />
    <div class="img-caption">Figure 1: Ashby live submission failure — "Your application submission was flagged as possible spam" (Notion Job Post).</div>
  </div>` : ""}

  <div class="callout">
    <strong>Ashby Action Items:</strong>
    <ol>
      <li>Use <code>launchPersistentContext()</code> linked to a real Chrome user profile containing active Google cookies.</li>
      <li>Route Playwright traffic through clean residential IPs (not AWS/DigitalOcean).</li>
      <li>Implement a 4-second Bezier mouse curve pause over the submit button to allow reCAPTCHA biometric scoring.</li>
    </ol>
  </div>

  <div class="page-break"></div>

  <h3>B. Greenhouse ATS</h3>
  <p><strong>Mechanisms & Evidence:</strong></p>
  <ul>
    <li><strong>React-Select State Desynchronization:</strong> Greenhouse modern boards (<code>job-boards.greenhouse.io</code>) use custom React components. Simply setting DOM <code>.value</code> or naive clicking leaves internal component state empty. Form submit is aborted by client validation.</li>
    <li><strong>Cloudflare Turnstile Verification:</strong> Greenhouse verifies a <code>cf-turnstile-response</code> token. Fast automated clicks without viewport scrolling fail Turnstile checks, resulting in: <em>"There was an error processing your application. Please try again."</em></li>
    <li><strong>8-Character Security Code (OTP):</strong> Suspicious or frequent requests trigger an email verification screen (*"Enter the 8-character code sent to your email"*), stalling unattended automation.</li>
  </ul>

  ${greenhouseBase64 ? `
  <div class="img-container">
    <img src="${greenhouseBase64}" alt="Greenhouse Form Validation Error Screenshot" />
    <div class="img-caption">Figure 2: Greenhouse client-side validation block — "This field is required" despite text presence (Vercel Job Post).</div>
  </div>` : ""}

  <div class="callout">
    <strong>Greenhouse Action Items:</strong>
    <ol>
      <li>Use <code>aria-controls</code> listbox scoping from <code>scratch/test-greenhouse-filling.ts</code> to guarantee genuine React synthetic event dispatch.</li>
      <li>Scroll the submit button into view 2 seconds before clicking to allow Cloudflare Turnstile token resolution.</li>
      <li>Set up an automated IMAP inbox listener to auto-fill the 8-character verification OTP when prompted.</li>
    </ol>
  </div>

  <h3>C. Lever ATS</h3>
  <p><strong>Mechanisms & Evidence:</strong></p>
  <ul>
    <li><strong>Interactive hCaptcha Challenges:</strong> Lever triggers an interactive visual puzzle (*"Select pictures with a motorcycle/bus"*). Without a solver or manual input, <code>textarea[name='h-captcha-response']</code> remains empty.</li>
    <li><strong>Codebase Inverted DRY_RUN Logic:</strong> In <code>src/ats/lever/lever.adapter.ts</code> line 405, <code>process.env.DRY_RUN !== 'false'</code> treats undefined/missing variables as <code>true</code>, completely skipping submit clicks.</li>
    <li><strong>Background Worker Rejection:</strong> In <code>src/scheduler/application-worker.ts</code> line 177, the worker hardcodes: <code>if (ats !== 'ASHBY' && ats !== 'GREENHOUSE') throw new Error(...)</code>, immediately dropping Lever jobs.</li>
    <li><strong>Typeahead Location Binding:</strong> Typing a location without selecting an item from the Twitter Typeahead suggestion leaves <code>selectedLocation</code> JSON null.</li>
  </ul>

  <div class="callout">
    <strong>Lever Action Items:</strong>
    <ol>
      <li>Change <code>process.env.DRY_RUN !== 'false'</code> to <code>process.env.DRY_RUN === 'true'</code> in <code>lever.adapter.ts</code>.</li>
      <li>Add <code>"LEVER"</code> to supported ATS list in <code>application-worker.ts</code>.</li>
      <li>Integrate CapSolver / 2Captcha API to inject <code>h-captcha-response</code> tokens during headless execution.</li>
    </ol>
  </div>

  <div class="page-break"></div>

  <h2>4. Engineering Implementation Roadmap</h2>
  
  <p>Follow this phased resolution plan to achieve 100% submission pass rates across all 3 platforms:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Phase</th>
        <th style="width: 45%;">Tasks</th>
        <th style="width: 35%;">Expected Outcome</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Phase 1: Quick Code Fixes</strong><br/><em>(Immediate)</em></td>
        <td>
          1. Fix <code>DRY_RUN === 'true'</code> check in <code>lever.adapter.ts</code>.<br/>
          2. Whitelist <code>LEVER</code> in <code>application-worker.ts</code>.<br/>
          3. Port <code>fillReactSelect()</code> from <code>test-greenhouse-filling.ts</code> to <code>greenhouse.adapter.ts</code>.
        </td>
        <td>Eliminates client-side validation errors and code bypasses immediately.</td>
      </tr>
      <tr>
        <td><strong>Phase 2: Anti-Bot & Fingerprinting</strong><br/><em>(High Priority)</em></td>
        <td>
          1. Configure <code>launchPersistentContext()</code> with active Google profile for Ashby.<br/>
          2. Bind residential proxy rotation.<br/>
          3. Add 3-5s pre-submit human review & mouse telemetry.
        </td>
        <td>Overcomes Ashby reCAPTCHA Enterprise spam flag and Greenhouse Turnstile rejections.</td>
      </tr>
      <tr>
        <td><strong>Phase 3: Automated Solver & OTP</strong><br/><em>(Production Ready)</em></td>
        <td>
          1. Integrate CapSolver/2Captcha for automated Lever hCaptcha token injection.<br/>
          2. Implement IMAP/Gmail API webhook for Greenhouse 8-character OTP entry.
        </td>
        <td>100% unattended, zero-human-intervention submission across all 3 ATS systems.</td>
      </tr>
    </tbody>
  </table>

  <h2>5. Conclusion</h2>
  <p>
    The submission failures are not caused by flawed form parsing or invalid profile data. They are the natural consequence of modern ATS security architecture (invisible reCAPTCHA Enterprise, Cloudflare Turnstile, and hCaptcha) combined with strict client-side component state lifecycles and minor configuration logic bugs.
  </p>
  <p>
    Applying the fixes in Phases 1 and 2 will immediately resolve standard submission blockers, with Phase 3 securing production-grade reliability.
  </p>

</body>
</html>
  `;

  const outputPath = path.resolve(__dirname, "../docs/ATS_Submission_Root_Cause_Analysis.pdf");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "15mm",
      bottom: "15mm",
      left: "14mm",
      right: "14mm"
    }
  });

  await browser.close();
  console.log(`✅ PDF successfully generated at: ${outputPath}`);
}

generatePdf().catch(console.error);
