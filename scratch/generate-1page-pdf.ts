import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function generateOnePagePdf() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ATS Automation Status - 1-Page Summary</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.35;
      font-size: 9pt;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .title-area h1 {
      font-size: 15.5pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .title-area p {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 2px;
      font-weight: 500;
    }
    .meta-box {
      text-align: right;
      font-size: 8pt;
      color: #475569;
    }
    .meta-tag {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
    }

    /* KPI Bar */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
    }
    .kpi-num {
      font-size: 13.5pt;
      font-weight: 800;
      line-height: 1.1;
    }
    .kpi-num.green { color: #16a34a; }
    .kpi-num.amber { color: #d97706; }
    .kpi-num.blue { color: #2563eb; }
    .kpi-label {
      font-size: 7.2pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-top: 2px;
    }

    /* Single Unified Table */
    .table-title {
      font-size: 10pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .table-badge {
      font-size: 7.5pt;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.2pt;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 5.5px 7px;
      border: 1px solid #cbd5e1;
      font-size: 7.8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 5.5px 7px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      line-height: 1.35;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2.5px 6px;
      border-radius: 4px;
      font-size: 7.2pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-warn { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

    .ats-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 8.5pt;
    }
    .vendor-sub {
      font-size: 7.2pt;
      color: #64748b;
      font-weight: 500;
    }
    .problem-highlight {
      color: #b91c1c;
      font-weight: 700;
    }
    .solution-highlight {
      color: #15803d;
      font-weight: 600;
    }

    /* Executive Footer */
    .footer-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-top: 6px;
    }
    .footer-box h4 {
      font-size: 8.5pt;
      font-weight: 700;
      color: #166534;
      margin-bottom: 2px;
    }
    .footer-box p {
      font-size: 7.8pt;
      color: #14532d;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="title-area">
      <h1>⚡ CLUCO.AI — ATS Automation Status Report</h1>
      <p>Master Technical Evaluation Matrix for Engineering Leadership</p>
    </div>
    <div class="meta-box">
      <span class="meta-tag">Master Status Matrix</span><br>
      <span style="font-size: 7.5pt; color: #64748b;">All 8 Platforms • 1 Single Table</span>
    </div>
  </div>

  <!-- KPI Metrics -->
  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-num blue">8</div>
      <div class="kpi-label">Platforms Evaluated</div>
    </div>
    <div class="kpi">
      <div class="kpi-num green">4 (50%)</div>
      <div class="kpi-label">Completed & Ready</div>
    </div>
    <div class="kpi">
      <div class="kpi-num amber">4 (50%)</div>
      <div class="kpi-label">Facing Issues</div>
    </div>
    <div class="kpi">
      <div class="kpi-num green">100% (8/8)</div>
      <div class="kpi-label">Form Extraction Rate</div>
    </div>
  </div>

  <!-- Single Unified Table -->
  <div class="table-title">
    <span>📊 All 8 ATS Platforms — Status & Technical Problem Matrix</span>
    <span class="table-badge">Sorted by Operational Readiness</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 17%;">ATS Platform</th>
        <th style="width: 15%;">Current Status</th>
        <th style="width: 36%;">Core Problem / Bottleneck Encountered</th>
        <th style="width: 32%;">Resolution / Technical Action Plan</th>
      </tr>
    </thead>
    <tbody>
      <!-- 1. SmartRecruiters -->
      <tr>
        <td>
          <div class="ats-title">1. SmartRecruiters</div>
          <div class="vendor-sub">Enterprise Global ATS</div>
        </td>
        <td><span class="badge badge-success">✅ Completed (100%)</span></td>
        <td><span class="solution-highlight">None (Clean Flow):</span> Zero bot blockers. Multi-language questions, resume parsing, consent checks pass cleanly.</td>
        <td><span class="solution-highlight">Production Ready:</span> Currently submitting live applications in production end-to-end.</td>
      </tr>

      <!-- 2. Oracle Cloud CX -->
      <tr>
        <td>
          <div class="ats-title">2. Oracle Cloud CX</div>
          <div class="vendor-sub">Fusion Recruiting</div>
        </td>
        <td><span class="badge badge-success">✅ Completed (100%)</span></td>
        <td><span class="solution-highlight">None (Solved):</span> Handled email verification gateway, legal disclaimers, and multi-section (1–3) auto-filling.</td>
        <td><span class="solution-highlight">Production Ready:</span> Dynamic work experience card expansion and contact auto-filling verified.</td>
      </tr>

      <!-- 3. Taleo (Oracle) -->
      <tr>
        <td>
          <div class="ats-title">3. Taleo (Oracle)</div>
          <div class="vendor-sub">Business Edition / v2</div>
        </td>
        <td><span class="badge badge-success">✅ Completed (100%)</span></td>
        <td><span class="solution-highlight">None (Solved):</span> Multi-step tab navigation, automated credential creation, resume file attachment verified.</td>
        <td><span class="solution-highlight">Production Ready:</span> Final review e-signature and submission execute with 100% success.</td>
      </tr>

      <!-- 4. Workable -->
      <tr>
        <td>
          <div class="ats-title">4. Workable</div>
          <div class="vendor-sub">Modern Mid-Market ATS</div>
        </td>
        <td><span class="badge badge-success">✅ Completed (100%)</span></td>
        <td><span class="solution-highlight">None (Solved):</span> Single-page extraction, automated screening question answers, resume upload pass cleanly.</td>
        <td><span class="solution-highlight">Production Ready:</span> Post-submit Cloudflare Turnstile handled gracefully via human mouse.</td>
      </tr>

      <!-- 5. Workday -->
      <tr>
        <td>
          <div class="ats-title">5. Workday</div>
          <div class="vendor-sub">Enterprise Fortune 500</div>
        </td>
        <td><span class="badge badge-warn">⚠️ Facing Issues</span></td>
        <td><span class="problem-highlight">Tenant Login & Auth Gate:</span> Mandates separate candidate account per company tenant; gets stuck on Sign-In/Sign-Up modals and session timeouts before form entry.</td>
        <td>Implement tenant-aware auto-registration handler, persistent session cookies per company, and automated sign-in recovery.</td>
      </tr>

      <!-- 6. Ashby -->
      <tr>
        <td>
          <div class="ats-title">6. Ashby</div>
          <div class="vendor-sub">Tech Job Board ATS</div>
        </td>
        <td><span class="badge badge-warn">⚠️ Facing Issues</span></td>
        <td><span class="problem-highlight">reCAPTCHA Enterprise / Rate Limit:</span> Scores session &lt;0.5 without mouse trajectories, blocking POST with <em>"possible spam"</em>. 3-app/60-day company limit.</td>
        <td>Implement Cubic Bézier human mouse curves + persistent Google-authenticated browser context + residential IP proxy.</td>
      </tr>

      <!-- 7. Greenhouse -->
      <tr>
        <td>
          <div class="ats-title">7. Greenhouse</div>
          <div class="vendor-sub">Tech Market Leader</div>
        </td>
        <td><span class="badge badge-warn">⚠️ Facing Issues</span></td>
        <td><span class="problem-highlight">React State Desync & Turnstile:</span> <code>react-select</code> dropdowns drop state causing <em>"This field is required"</em>; Turnstile token check and 8-char email OTP prompt.</td>
        <td>Scoped <code>aria-controls</code> synthetic event bubbling for dropdowns + 2s Turnstile bottom dwell + automated email OTP listener.</td>
      </tr>

      <!-- 8. Lever -->
      <tr>
        <td>
          <div class="ats-title">8. Lever</div>
          <div class="vendor-sub">Tech Startup ATS</div>
        </td>
        <td><span class="badge badge-warn">⚠️ Facing Issues</span></td>
        <td><span class="problem-highlight">Interactive hCaptcha Modal:</span> Submit trigger halts on visual puzzle challenge (*"Select images with buses"*), timing out headless runs (90s). Location JSON binding.</td>
        <td>Inject verified tokens via automated CAPTCHA solver service (CapSolver API) + enforce strict Typeahead location suggestion selection.</td>
      </tr>
    </tbody>
  </table>

  <!-- Management Takeaway -->
  <div class="footer-box">
    <h4>📌 Executive Recommendation & Sprint Focus</h4>
    <p>
      <strong>Live Scaling (4 Platforms):</strong> <strong>SmartRecruiters, Oracle Cloud CX, Taleo, and Workable</strong> are 100% production-ready and active today.<br>
      <strong>Remediation Sprint (4 Platforms):</strong> Focus engineering effort on <strong>Workday's Auth/Login Gateway</strong>, the <strong>Bézier Human Mouse Engine (Ashby/Greenhouse)</strong>, and <strong>Automated CAPTCHA Solvers (Lever)</strong> to achieve >90% unblocked submission across all 8 ATS.
    </p>
  </div>
</body>
</html>
  `;

  await page.setContent(html, { waitUntil: "networkidle" });

  const rootPdfPath = path.resolve(__dirname, "../ATS_Status_1Page_Summary.pdf");
  const docsPdfPath = path.resolve(__dirname, "../docs/ATS_Status_1Page_Summary.pdf");

  await page.pdf({
    path: rootPdfPath,
    format: "A4",
    printBackground: true,
    pageRanges: "1" // Guarantees strictly 1 single page!
  });

  await page.pdf({
    path: docsPdfPath,
    format: "A4",
    printBackground: true,
    pageRanges: "1"
  });

  console.log("Successfully updated 1-page PDF with 1 single table & Workday in Facing Issues:");
  console.log("1.", rootPdfPath);
  console.log("2.", docsPdfPath);

  await browser.close();
}

generateOnePagePdf().catch(console.error);
