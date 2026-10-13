import fs from "fs";
import path from "path";
import { db } from "../../database/db";

export interface WorkdayCredential {
  domain: string;
  email: string;
  password: string;
  updatedAt: string;
}

const LOCAL_STORE_PATH = path.resolve(process.cwd(), "data", "workday_credentials.json");

/**
 * Ensures the local data directory and file exist
 */
function getLocalCredentials(): Record<string, WorkdayCredential> {
  try {
    const dir = path.dirname(LOCAL_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const data = fs.readFileSync(LOCAL_STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err: any) {
    console.warn("⚠️ [WorkdayAccountStore]: Failed to read local credentials file:", err.message);
  }
  return {};
}

function saveLocalCredentials(store: Record<string, WorkdayCredential>): void {
  try {
    const dir = path.dirname(LOCAL_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("⚠️ [WorkdayAccountStore]: Failed to write local credentials file:", err.message);
  }
}

/**
 * Initializes database table if PostgreSQL is available
 */
let dbInitialized = false;
async function ensureDbTable(): Promise<void> {
  if (dbInitialized) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.ats_credentials (
        id text NOT NULL DEFAULT gen_random_uuid(),
        domain text NOT NULL,
        email text NOT NULL,
        password text NOT NULL,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ats_credentials_pkey PRIMARY KEY (id),
        CONSTRAINT ats_credentials_domain_email_key UNIQUE (domain, email)
      );
    `);
    dbInitialized = true;
  } catch (err: any) {
    // Non-fatal, local fallback is active
    dbInitialized = true;
  }
}

/**
 * Extracts a normalized tenant domain from a URL or hostname
 */
export function extractWorkdayDomain(urlOrHost: string): string {
  try {
    if (urlOrHost.includes("://")) {
      const parsed = new URL(urlOrHost);
      return parsed.hostname.toLowerCase();
    }
    return urlOrHost.toLowerCase();
  } catch {
    return urlOrHost.toLowerCase();
  }
}

/**
 * Looks up saved credentials for a Workday domain and email
 */
export async function getWorkdayCredentials(domain: string, email?: string): Promise<WorkdayCredential | null> {
  const normDomain = extractWorkdayDomain(domain);
  const normEmail = email ? email.toLowerCase().trim() : "";
  const key = normEmail ? `${normDomain}:${normEmail}` : "";

  // 1. Check local JSON cache first
  const local = getLocalCredentials();
  if (key && local[key]) {
    return local[key];
  }

  // 2. Query Postgres for exact match if email was provided
  try {
    await ensureDbTable();
    if (normEmail) {
      const res = await db.query(
        `SELECT domain, email, password, updated_at as "updatedAt" FROM public.ats_credentials WHERE domain = $1 AND email = $2 LIMIT 1`,
        [normDomain, normEmail]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0] as any;
        const cred: WorkdayCredential = {
          domain: row.domain,
          email: row.email,
          password: row.password,
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
        };
        // Cache locally
        local[key] = cred;
        saveLocalCredentials(local);
        return cred;
      }
    }

    // 3. Query Postgres for most recent ACTIVE credentials for this domain
    const anyRes = await db.query(
      `SELECT domain, email, password, updated_at as "updatedAt" FROM public.ats_credentials WHERE domain = $1 AND (account_status IS NULL OR account_status = 'ACTIVE') AND password IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
      [normDomain]
    ).catch(() => ({ rows: [] }));
    if (anyRes.rows && anyRes.rows.length > 0) {
      const row = anyRes.rows[0] as any;
      const cred: WorkdayCredential = {
        domain: row.domain,
        email: row.email,
        password: row.password,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
      };
      return cred;
    }

    // 4. Fallback: Check local cache for most recently updated credentials for this domain
    const matchingLocal = Object.values(local)
      .filter(c => c.domain === normDomain && c.password)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    if (matchingLocal.length > 0) {
      return matchingLocal[0];
    }
  } catch (err: any) {
    // Database query failed, rely on local fallback
    const matchingLocal = Object.values(local)
      .filter(c => c.domain === normDomain && c.password)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    if (matchingLocal.length > 0) {
      return matchingLocal[0];
    }
  }

  return null;
}

/**
 * Returns all saved credentials for a Workday domain, prioritizing candidateEmail and most recent ACTIVE accounts
 */
export async function getAllWorkdayCredentials(domain: string, candidateEmail?: string): Promise<WorkdayCredential[]> {
  const normDomain = extractWorkdayDomain(domain);
  const normEmail = candidateEmail ? candidateEmail.toLowerCase().trim() : "";
  const creds: WorkdayCredential[] = [];
  const seenEmails = new Set<string>();

  // 1. Query Postgres for all credentials for this domain
  try {
    await ensureDbTable();
    const res = await db.query(
      `SELECT domain, email, password, updated_at as "updatedAt", account_status FROM public.ats_credentials WHERE domain = $1 AND password IS NOT NULL AND (account_status IS NULL OR account_status != 'INVALID_CREDENTIALS') ORDER BY (account_status = 'ACTIVE') DESC, updated_at DESC`,
      [normDomain]
    ).catch(() => ({ rows: [] }));

    for (const row of (res.rows || []) as any[]) {
      if (row.email && row.password && !seenEmails.has(row.email.toLowerCase())) {
        seenEmails.add(row.email.toLowerCase());
        creds.push({
          domain: row.domain,
          email: row.email,
          password: row.password,
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
        });
      }
    }
  } catch {}

  // 2. Add any credentials from local JSON cache
  const local = getLocalCredentials();
  const localCreds = Object.values(local)
    .filter(c => c.domain === normDomain && c.password)
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  for (const c of localCreds) {
    if (!seenEmails.has(c.email.toLowerCase())) {
      seenEmails.add(c.email.toLowerCase());
      creds.push(c);
    }
  }

  // 3. If candidateEmail was provided and exists in creds, prioritize it first
  if (normEmail) {
    const idx = creds.findIndex(c => c.email.toLowerCase() === normEmail);
    if (idx > 0) {
      const [favored] = creds.splice(idx, 1);
      creds.unshift(favored);
    }
  }

  return creds;
}

/**
 * Persists Workday candidate credentials
 */
export async function saveWorkdayCredentials(domain: string, email: string, password: string): Promise<void> {
  const normDomain = extractWorkdayDomain(domain);
  const normEmail = email.toLowerCase().trim();
  const key = `${normDomain}:${normEmail}`;
  const now = new Date().toISOString();

  const cred: WorkdayCredential = {
    domain: normDomain,
    email: normEmail,
    password,
    updatedAt: now
  };

  // 1. Save to local JSON store
  const local = getLocalCredentials();
  local[key] = cred;
  saveLocalCredentials(local);
  console.log(`💾 [WorkdayAccountStore]: Remembered credentials for ${normDomain} (${normEmail}) locally.`);

  // 2. Save to Postgres
  try {
    await ensureDbTable();
    await db.query(
      `INSERT INTO public.ats_credentials (domain, email, password, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (domain, email)
       DO UPDATE SET password = EXCLUDED.password, updated_at = CURRENT_TIMESTAMP;`,
      [normDomain, normEmail, password]
    );
    console.log(`💾 [WorkdayAccountStore]: Persisted credentials for ${normDomain} into database.`);
  } catch (err: any) {
    console.warn(`⚠️ [WorkdayAccountStore]: Database persistence skipped (${err.message}). Local storage intact.`);
  }
}

/**
 * Marks credentials as invalid in both local storage and database
 */
export async function markCredentialInvalid(domain: string, email: string): Promise<void> {
  const normDomain = extractWorkdayDomain(domain);
  const normEmail = email.toLowerCase().trim();
  const key = `${normDomain}:${normEmail}`;

  // 1. Remove from local store
  const local = getLocalCredentials();
  if (local[key]) {
    delete local[key];
    saveLocalCredentials(local);
  }

  // 2. Mark INVALID_CREDENTIALS in Postgres
  try {
    await db.query(
      `UPDATE public.ats_credentials SET account_status = 'INVALID_CREDENTIALS', updated_at = NOW() WHERE domain = $1 AND email = $2`,
      [normDomain, normEmail]
    );
  } catch {}
}

