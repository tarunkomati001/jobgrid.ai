# ⚡ CLUCO.AI AUTO-PILOT ENGINE

**Automated Job Application Engine for Modern Applicant Tracking Systems (ATS)**

`CLUCO.AI` is an intelligent, automated job application filling and submission platform built with Node.js, TypeScript, Playwright, PostgreSQL/Supabase, and BullMQ. It automates finding, opening, parsing, autofilling, verifying, and submitting job applications on modern ATS platforms (such as Ashby, Greenhouse, Lever, etc.) while evading anti-bot detection and preserving interactive visual feedback.

---

## 📌 1. Project Overview & Architecture

### Key Capabilities
- **Universal Form Extraction**: Scrapes and parses logical form structures, inputs, selects, radio groups, checkboxes, and Yes/No button components.
- **Smart Data Mapping & Persistence**: Maps user profile fields, normalizes question labels, checks saved database answers (`user_saved_answers`), and dynamically generates smart answers for unknown custom screening questions.
- **Resume Upload & Path Resolver**: Dynamically resolves local resume paths across different machine environments (`src/utils/path-resolver.ts`), avoiding hardcoded file path breakage.
- **Form Filling & Verification Loop**: Uses a 3-attempt retry filling strategy with real-time DOM verification (`fillAndVerifyWithRetry`) to ensure inputs retain values.
- **Anti-Bot & Stealth Engine**: Suppresses `navigator.webdriver`, mocks native browser APIs (`plugins`, `languages`), and simulates human-like mouse movements and keypress timing (`applyStealthScripts`, `simulateHumanMouse`).
- **Visual HUD (Headed Mode)**: Renders a floating real-time status overlay and field highlighting on application pages to demonstrate progress visually.
- **Execution Modes**:
  - **Sequential Mode** (`--sequential`): Fills applications step-by-step to prevent anti-bot rate limits and IP blocks.
  - **Parallel Mode** (`--parallel`): Runs multiple application tabs simultaneously.
  - **Simulation / Dry-Run** (`DRY_RUN=true`): Performs complete form filling, uploads resume, and validates inputs without clicking the final submit button.
  - **Live Submission Mode** (`--submit` / `--live` / `DRY_RUN=false`): Submits real applications to ATS backends.
  - **Window Control** (`--keep-open`): Keeps browser tabs open after completion or on anti-bot notices for visual inspection.

---

## 🏗️ 2. Project Directory Structure

```
cluco.ai/
├── src/
│   ├── application/
│   │   └── field-mapper.ts         # Maps question labels to profile keys & normalizes text
│   ├── ats/
│   │   ├── ashby/
│   │   │   └── ashby.adapter.ts    # Ashby ATS implementation (extract, fill, upload, submit)
│   │   ├── ats-detector.ts         # Detects active ATS engine by page URL and DOM
│   │   └── ats.interface.ts        # Common interfaces (ATSAdapter, FormField, UserProfile, etc.)
│   ├── browser/
│   │   ├── browser-manager.ts      # Playwright browser launcher & anti-bot stealth scripts
│   │   ├── form-filler.ts          # Core DOM extractor, field filler, retry & verification engine
│   │   └── visual-hud.ts           # On-screen HUD overlay for headed execution
│   ├── database/
│   │   ├── db.ts                   # PostgreSQL / Supabase connection pool
│   │   ├── event-logger.ts         # Logs application audit trail events
│   │   ├── migrate.ts              # Database schema migration runner
│   │   └── schema.sql              # SQL database table definitions
│   ├── scheduler/
│   │   ├── application-queue.ts    # BullMQ job queue setup
│   │   └── application-worker.ts   # Asynchronous queue worker for background processing
│   ├── scripts/
│   │   ├── add-job.ts              # Script to add new job URLs to database
│   │   ├── check-db.ts             # Script to verify database records
│   │   ├── headed-autofill.ts      # Primary auto-pilot CLI script (Headed/Headless mode)
│   │   └── run-pipeline.ts         # Full end-to-end pipeline runner
│   ├── utils/
│   │   └── path-resolver.ts        # Dynamic cross-machine file path resolver for resumes
│   ├── config.ts                   # Environment configuration variables
│   └── server.ts                   # Express API server for testing & remote job triggers
├── resumes/                        # Local resume storage directory (PDF files)
├── screenshots/                    # Application proof screenshots
├── scratch/                        # Diagnostic and repair scripts
├── .env                            # Environment variables (Database URL, Redis, etc.)
├── package.json
└── tsconfig.json
```

---

## 🗄️ 3. Database Schema Overview

PostgreSQL / Supabase tables (`src/database/schema.sql`):

1. **`users`**: User login credentials and accounts.
2. **`user_profiles`**: Comprehensive user profile data (Name, Email, Phone, Location, LinkedIn, GitHub, Portfolio, Work Authorization, Years of Experience, Relocation).
3. **`resumes`**: User resume files, active status, file paths (`file_path`).
4. **`jobs`**: Discovered and target job application URLs, company, title, ATS type, status.
5. **`applications`**: Application execution logs, status (`PENDING`, `SUBMITTED`, `FAILED`), confirmation details, error messages, screenshot paths.
6. **`user_saved_answers`**: Persisted question-answer database mapping (`normalized_question` -> `answer`), storing previously answered custom screening questions and AI generated answers.
7. **`application_events`**: Audit log events (`JOB_OPENED`, `ATS_DETECTED`, `RESUME_UPLOADED`, `FORM_FILLED`, `SUBMITTED`).

---

## ⚙️ 4. Form Filler Logic & Workflow

When processing a job application page:

```
[1. Navigate & Detect ATS] -> [2. Extract Fields] -> [3. Upload Resume] -> [4. Fill Form] -> [5. Validate] -> [6. Submit]
```

1. **Extraction (`extractLogicalFields`)**:
   - Scrolls the page to trigger dynamic renders.
   - Groups radio buttons, checkboxes, selects, Yes/No buttons, text inputs, and file fields into logical question blocks.
2. **Resume Upload (`uploadResume`)**:
   - Dynamically resolves resume path using `resolveLocalResumePath`.
   - Sets files using Playwright `setInputFiles` and dispatches `change` events.
   - Verifies upload status by checking DOM file elements or upload status indicators.
3. **Form Autofilling (`fillForm` & `fillLogicalField`)**:
   - Matches field labels against standard profile fields (`firstName`, `email`, `linkedinUrl`, etc.).
   - Checks user parameters (`additionalAnswers`).
   - Queries `user_saved_answers` in database by normalized question overlap ratio.
   - For missing fields, generates smart AI answers and automatically saves them into `user_saved_answers` for future runs.
4. **Verification & Retry (`fillAndVerifyWithRetry`)**:
   - After filling each field, reads DOM input values to verify retainment.
   - Retries up to 3 times using fallback typing and event dispatching if verification fails.
5. **Submission (`submit`)**:
   - Validates all required inputs before submission.
   - Waits for `grecaptcha` readiness inside iframe targets.
   - Performs human-like hover and mouse click on submit buttons.
   - Detects success confirmation text or anti-bot error banners ("Pause browser extensions" / "Spam flagged").

---

## 🚀 5. Command Line Usage & CLI Options

### Primary Headed Auto-Pilot Script
```bash
# Run 1 job in sequential mode to test autofill visually
npx tsx src/scripts/headed-autofill.ts --sequential --limit 1

# Run with windows kept open after completion for inspection
npx tsx src/scripts/headed-autofill.ts --sequential --keep-open

# Run live submit on a specific job URL
npx tsx src/scripts/headed-autofill.ts "https://jobs.ashbyhq.com/company/job-id" --submit --keep-open

# Run parallel execution on all queued jobs in simulation mode
npx tsx src/scripts/headed-autofill.ts --parallel
```

### Script CLI Flags
- `--submit` / `--live`: Enable real application submission (`DRY_RUN=false`). Default is dry-run simulation mode.
- `--sequential`: Process jobs step-by-step (1 job at a time). Recommended to avoid ATS anti-bot IP blocks.
- `--parallel`: Open and fill all job tabs at once.
- `--keep-open` / `--no-close`: Keeps browser tabs open after execution or on failure for manual review.
- `--limit N`: Restrict execution to `N` jobs from the database.

---

## 🛠️ 6. Environment Variables (`.env`)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/cluco
PORT=3000
DRY_RUN=false
HEADLESS=false
REDIS_URL=redis://localhost:6379
```

---

## 📝 7. How to Explain This Project to an AI Assistant

When prompting ChatGPT, Gemini, or Claude about this codebase, copy and paste the context below:

> "I have a TypeScript / Node.js web application auto-pilot project named `CLUCO.AI` that uses Playwright and PostgreSQL to automatically fill out and submit job applications on Applicant Tracking Systems (ATS) like Ashby. 
> Key components include:
> - `src/ats/ashby/ashby.adapter.ts` for parsing Ashby job posts and application forms (both main page and embedded `jobs.ashbyhq.com` iframes).
> - `src/browser/form-filler.ts` for extracting DOM fields, filling inputs/radios/checkboxes/selects/files, and retrying up to 3 times with verification (`fillAndVerifyWithRetry`).
> - `src/utils/path-resolver.ts` for dynamically resolving resume file paths across different operating systems/environments.
> - `src/scripts/headed-autofill.ts` CLI script supporting sequential execution (`--sequential`), live submission (`--submit`), and persistent windows (`--keep-open`).
> - Database storage in PostgreSQL (`user_profiles`, `resumes`, `jobs`, `applications`, `user_saved_answers`)."
