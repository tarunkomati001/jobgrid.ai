import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function generatePdf() {
  const outputPath = path.resolve(process.cwd(), "Workday_Login_Issues_Executive_Summary.pdf");
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Workday Login Issues - Root Cause Analysis</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4;
      margin: 12mm 14mm 12mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 9.5pt;
      line-height: 1.45;
    }

    .header-banner {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .header-title-block h1 {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 2px;
    }

    .header-title-block .subtitle {
      font-size: 9.5pt;
      color: #0284c7;
      font-weight: 600;
    }

    .meta-table {
      font-size: 8pt;
      color: #64748b;
      text-align: right;
    }

    .meta-table td {
      padding: 1px 3px;
    }

    .meta-table strong {
      color: #334155;
    }

    .badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    h2 {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 10px;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    h2 .num {
      background: #0284c7;
      color: white;
      width: 17px;
      height: 17px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: 700;
      margin-right: 4px;
    }

    p {
      margin-bottom: 6px;
      color: #334155;
    }

    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3.5px solid #0284c7;
      border-radius: 5px;
      padding: 8px 11px;
      margin-bottom: 10px;
    }

    .card.warning {
      background: #fffbeb;
      border-color: #fef3c7;
      border-left-color: #f59e0b;
    }

    .card.error {
      background: #fef2f2;
      border-color: #fee2e2;
      border-left-color: #ef4444;
    }

    .card-title {
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }

    .points-list {
      list-style: none;
      margin-bottom: 6px;
    }

    .points-list li {
      position: relative;
      padding-left: 18px;
      margin-bottom: 7px;
      color: #334155;
      font-size: 9pt;
      line-height: 1.4;
    }

    .points-list li::before {
      content: "•";
      color: #0284c7;
      font-weight: bold;
      font-size: 13pt;
      position: absolute;
      left: 3px;
      top: -3px;
    }

    .points-list strong {
      color: #0f172a;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 10px 0;
      font-size: 8.5pt;
    }

    table.data-table th,
    table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      text-align: left;
    }

    table.data-table th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }

    table.data-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .code-inline {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 3px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    .architecture-box {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 5px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      line-height: 1.4;
      margin: 8px 0 10px 0;
      white-space: pre-wrap;
    }

    .page-break {
      page-break-before: always;
    }

    .footer-note {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-banner">
    <div class="header-title-block">
      <span class="badge">Executive Technical Briefing</span>
      <h1>Workday ATS Authentication & Autofill Analysis</h1>
      <div class="subtitle">Root-Cause Analysis, Architectural Friction Points & Strategic Solutions</div>
    </div>
    <table class="meta-table">
      <tr><td><strong>Author:</strong></td><td>Engineering Team</td></tr>
      <tr><td><strong>Date:</strong></td><td>October 2026</td></tr>
      <tr><td><strong>Audience:</strong></td><td>Engineering Manager & Leadership</td></tr>
      <tr><td><strong>Status:</strong></td><td>Technical Root-Cause Report</td></tr>
    </table>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="card">
    <div class="card-title">Executive Summary</div>
    <p>
      Unlike centralized job boards (e.g., LinkedIn, Indeed) or unified ATS platforms (Greenhouse, Lever), <strong>Workday is fundamentally designed as a siloed, multi-tenant enterprise ERP platform</strong>. Each hiring enterprise operates on its own dedicated cluster partition and maintains completely isolated candidate credentials and security policies. This document details why automated Workday logins and submissions fail when treated as a single unified system, and outlines the precise architectural mechanisms required to achieve robust end-to-end automation.
    </p>
  </div>

  <!-- MAIN CAUSES POINT BY POINT -->
  <h2><span class="num">1</span> Core Root Causes of Workday Login Failures</h2>

  <ul class="points-list">
    <li>
      <strong>Strict Tenant Credential Isolation (No Shared Accounts):</strong><br>
      Each employer (e.g., <em>Alcon</em> on <span class="code-inline">alcon.wd5.myworkdayjobs.com</span> vs. <em>Clario</em> on <span class="code-inline">clarioclinical.wd1.myworkdayjobs.com</span>) has a 100% physically isolated user database. An account created on Alcon <strong>does not exist</strong> on Clario or any other company. Attempting to "Sign In" to a new company using existing credentials triggers:
      <div class="card error" style="margin: 6px 0 8px 0; padding: 6px 10px;">
        <em>"You may have entered the wrong email address or password or your account might be locked."</em>
      </div>
    </li>

    <li>
      <strong>Binary State Race Condition (Sign In vs. Create Account Collision):</strong><br>
      Automations struggle because the page presents two distinct actions: <em>"Sign In"</em> and <em>"Create Account"</em>.
      If the automation clicks <em>"Sign In"</em> for a candidate who has never applied to that specific company, authentication fails immediately. Conversely, if it clicks <em>"Create Account"</em> and the candidate previously applied to that company in a prior session, Workday blocks registration with:
      <div class="card warning" style="margin: 6px 0 8px 0; padding: 6px 10px;">
        <em>"An account with this email address already exists. Please sign in."</em>
      </div>
      Without dynamic fallback handling, the script reaches a dead-end.
    </li>

    <li>
      <strong>Heterogeneous Password Policies Across Companies:</strong><br>
      Workday allows each enterprise tenant administrator to define bespoke password rules. Company A may require 8 characters with 1 symbol, while Company B mandates 10+ characters, numbers, uppercase, lowercase, and strictly forbids substrings matching the candidate's first name, last name, or email username. A single hardcoded password frequently violates these tenant-specific rules.
    </li>

    <li>
      <strong>Anti-Bot & WAF Perimeter Protection (Cloudflare / Akamai):</strong><br>
      Workday heavily protects authentication endpoints (<span class="code-inline">/login</span>, <span class="code-inline">/createAccount</span>) with Akamai Bot Manager and Cloudflare Turnstile. Standard headless browsers or rapid programmatic typing trigger CAPTCHAs, rate-limiting HTTP 429 errors, or silent form rejections.
    </li>

    <li>
      <strong>Workday Canvas SPA Architecture & Session Redirection:</strong><br>
      Workday applications are built on proprietary React/Canvas SPAs. After entering credentials, the UI does not trigger a standard HTML page reload; it renders dynamic loading spinners, updates authorization cookies asynchronously, and routes through internal session URLs. If an automation attempts to read or fill fields before full client hydration, it interacts with detached DOM nodes.
    </li>
  </ul>

  <!-- PAGE BREAK FOR CLEAN PRINTING -->
  <div class="page-break"></div>

  <!-- COMPARISON TABLE -->
  <h2><span class="num">2</span> Architectural Comparison: Workday vs. Other ATS Platforms</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 22%;">ATS Platform</th>
        <th style="width: 28%;">Account Model</th>
        <th style="width: 25%;">Authentication Friction</th>
        <th style="width: 25%;">Autofill Complexity</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Greenhouse / Lever</strong></td>
        <td>No login required. Direct public submission form.</td>
        <td>Zero (No passwords or accounts).</td>
        <td>Low. Single-page DOM.</td>
      </tr>
      <tr>
        <td><strong>Ashby / SmartRecruiters</strong></td>
        <td>Optional or simple passwordless email link.</td>
        <td>Low. One-click or magic link.</td>
        <td>Low to Medium. Clean APIs.</td>
      </tr>
      <tr>
        <td><strong>Workable</strong></td>
        <td>Direct submission with optional phone/SMS OTP.</td>
        <td>Low. Public candidate upload.</td>
        <td>Medium. Multi-step modals.</td>
      </tr>
      <tr>
        <td><strong>Workday</strong></td>
        <td><strong>Siloed Per-Tenant Credentials</strong> (<span class="code-inline">wd1</span>, <span class="code-inline">wd3</span>, <span class="code-inline">wd5</span>).</td>
        <td><strong>Critical High</strong> (Mandatory login/signup per employer).</td>
        <td><strong>High</strong> (Multi-step wizard, dynamic dropdowns, strict validation).</td>
      </tr>
    </tbody>
  </table>

  <!-- ARCHITECTURE DIAGRAM -->
  <h2><span class="num">3</span> How Workday Multi-Tenancy Isolates Candidate Accounts</h2>
  <div class="architecture-box">
+-----------------------------------------------------------------------------------+
|                        CANDIDATE: Hrutin Nammi                                    |
|                        Email: user@example.com / Password: *****                  |
+-----------------------------------------------------------------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
         v                                                   v
+-----------------------------------+   +-----------------------------------+
| TENANT A: Alcon (wd5)             |   | TENANT B: Clario Clinical (wd1)   |
| URL: alcon.wd5.myworkdayjobs.com  |   | URL: clarioclinical.wd1...        |
+-----------------------------------+   +-----------------------------------+
| [Database A]                      |   | [Database B]                      |
| Candidate Account: REGISTERED     |   | Candidate Account: NOT FOUND      |
|                                   |   |                                   |
| Action Needed: SIGN IN            |   | Action Needed: CREATE ACCOUNT     |
| (Attempting Sign Up -> REJECTED)  |   | (Attempting Sign In -> REJECTED)  |
+-----------------------------------+   +-----------------------------------+
  </div>

  <!-- THE SOLUTION / ROADMAP -->
  <h2><span class="num">4</span> Implemented Solutions & Architectural Fixes</h2>

  <ul class="points-list">
    <li>
      <strong>Bi-Directional Adaptive Authentication State Machine:</strong><br>
      The script now implements a self-healing two-way detection flow:
      <br>1. Check if the page is currently on Sign In or Create Account.
      <br>2. First attempt authentication. If Workday responds with <em>"Invalid credentials"</em> or <em>"Account does not exist"</em>, automatically switch to <strong>Create Account</strong>.
      <br>3. If Create Account indicates <em>"Account already exists"</em>, instantly switch back to <strong>Sign In</strong>.
    </li>

    <li>
      <strong>Tenant-Compliant Master Password Generation:</strong><br>
      Standardized on a compliant, high-entropy password pattern (e.g. 14+ characters, mixed case, numbers, and allowed punctuation like <span class="code-inline">!@#</span>) that complies with all known Workday tenant constraints and does not incorporate candidate name substrings.
    </li>

    <li>
      <strong>Stealth Fingerprinting & Humanized Keystrokes:</strong><br>
      Integrated Playwright stealth mode to bypass Akamai and Cloudflare bot detection, incorporating random typing cadence (<span class="code-inline">delay: 50-90ms</span>) and proper focus/blur event triggering.
    </li>

    <li>
      <strong>Full-Flow Profile Hydration:</strong><br>
      Once past the authentication gateway, our adapter automatically hydrates Work Experience (Start Date <span class="code-inline">01/2024</span>, End Date <span class="code-inline">01/2026</span>), Education, Contact Details, and Legal Disclosures without triggering date collisions or redundant attachment downloads.
    </li>
  </ul>

  <div class="footer-note">
    <span>Cluco AI ATS Automation Engine &bull; Workday Technical Report</span>
    <span>CONFIDENTIAL &bull; FOR INTERNAL MANAGEMENT USE ONLY</span>
  </div>

</body>
</html>
  `;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "14mm",
      bottom: "14mm",
      left: "14mm",
      right: "14mm",
    },
  });

  await browser.close();
  console.log(`✅ Successfully generated executive PDF at: ${outputPath}`);
}

generatePdf().catch((err) => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});
