import sqlite3 from "sqlite3";
import { Pool } from "pg";
import path from "path";
import { config } from "../config";

const isPostgres = config.dbUrl.startsWith("postgresql://") || config.dbUrl.startsWith("postgres://");

let sqliteDb: sqlite3.Database | null = null;
let pgPool: Pool | null = null;

if (isPostgres) {
  console.log("🔌 Connecting to PostgreSQL/Supabase database...");
  pgPool = new Pool({
    connectionString: config.dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
  });

  // Handle pool-level idle client errors silently to prevent unhandled process crashes
  pgPool.on("error", (err) => {
    console.warn("⚠️ [PostgreSQL Pool Warning]: Idle client connection dropped:", err.message);
  });
} else {
  // Extract filename from dbUrl, e.g. "sqlite://localhost/job_automation.db" -> "job_automation.db"
  const dbFileName = config.dbUrl.split("/").pop() || "job_automation.db";
  const dbPath = path.isAbsolute(dbFileName) 
    ? dbFileName 
    : path.resolve(__dirname, "../../", dbFileName);

  console.log(`🔌 Connecting to SQLite database at: ${dbPath}`);

  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("❌ Failed to connect to SQLite database:", err.message);
    } else {
      console.log("✅ Connected to SQLite database.");
      // Enable foreign key constraints in SQLite
      sqliteDb!.run("PRAGMA foreign_keys = ON;");
    }
  });
}

export const db = {
  /**
   * Executes a database query. Automatically routes to PostgreSQL or SQLite.
   * For PostgreSQL, translates SQLite-specific date functions (datetime('now'), date('now'), etc.) to PG dialect.
   * For SQLite, translates Postgres-style parameters ($1, $2) to SQLite style (?).
   */
  async query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();

    if (pgPool) {
      // Postgres Dialect: Translate SQLite-specific functions to PG equivalents
      let pgText = text
        .replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP")
        .replace(/date\('now'\)/gi, "CURRENT_DATE")
        .replace(/date\(([^)]+)\)/gi, "($1)::date");

      let result;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          result = await pgPool.query(pgText, params);
          break;
        } catch (err: any) {
          lastErr = err;
          const isTransient =
            err.message?.includes("Connection terminated") ||
            err.message?.includes("closed") ||
            err.code === "ECONNRESET" ||
            err.code === "ENOTFOUND" ||
            err.code === "ETIMEDOUT" ||
            err.code === "ECONNREFUSED" ||
            err.code === "57P01";

          if (isTransient && attempt < 3) {
            console.warn(`⚠️ [PostgreSQL Query Retry]: Transient error (${err.code || err.message}), retrying query (attempt ${attempt}/3)...`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
          } else {
            throw err;
          }
        }
      }
      const duration = Date.now() - start;

      if (config.isDev) {
        console.log(`[Postgres Query] executed in ${duration}ms | rows: ${result?.rowCount || 0}`);
      }

      return {
        rows: ((result?.rows) || []) as T[],
        rowCount: result?.rowCount || 0,
      };
    } else if (sqliteDb) {
      // Parse out PostgreSQL placeholders ($1, $2) and reorder params array to match sequential SQLite (?) bindings
      const matches = text.match(/\$\d+/g) || [];
      let sqliteText = text;
      let sqliteParams = [...params];

      if (matches.length > 0) {
        const paramIndexes = matches.map(m => parseInt(m.substring(1), 10));
        sqliteParams = paramIndexes.map(idx => params[idx - 1]);
        sqliteText = text.replace(/\$\d+/g, "?");
      }

      return new Promise((resolve, reject) => {
        sqliteDb!.all(sqliteText, sqliteParams, function (err, rows) {
          if (err) {
            console.error(`❌ DB Query Error: ${err.message}\nSQL: ${sqliteText}\nParams:`, params);
            reject(err);
            return;
          }

          const duration = Date.now() - start;
          const rowCount = rows ? rows.length : 0;

          if (config.isDev) {
            console.log(`[SQLite Query] executed in ${duration}ms | rows: ${rowCount}`);
          }

          resolve({
            rows: (rows || []) as T[],
            rowCount,
          });
        });
      });
    } else {
      throw new Error("No database connection initialized");
    }
  },

  /**
   * Closes the active database connection(s).
   */
  async close(): Promise<void> {
    if (pgPool) {
      await pgPool.end();
      console.log("🔌 PostgreSQL connection pool closed.");
    } else if (sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb!.close((err) => {
          if (err) {
            console.error("Error closing SQLite database:", err.message);
            reject(err);
          } else {
            console.log("🔌 SQLite connection closed.");
            resolve();
          }
        });
      });
    }
  },

  /**
   * Executes multiple semicolon-separated SQL statements. Useful for migrations.
   */
  async exec(text: string): Promise<void> {
    if (pgPool) {
      await pgPool.query(text);
    } else if (sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb!.exec(text, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      throw new Error("No database connection initialized");
    }
  },

  sqliteDb,
  pgPool,
};
