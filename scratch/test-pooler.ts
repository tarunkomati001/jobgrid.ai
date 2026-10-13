import { Pool } from "pg";

async function testPoolerConnection() {
  const connectionStrings = [
    "postgresql://postgres.ovewmitrxkzjxrmbhyyk:Tarunbabu%402006@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres.ovewmitrxkzjxrmbhyyk:Tarunbabu%402006@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    "postgresql://postgres:Tarunbabu%402006@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:Tarunbabu%402006@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
  ];

  for (const connStr of connectionStrings) {
    console.log(`\nTesting connection string: ${connStr.replace(/Tarunbabu%402006/g, "*****")}`);
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      const res = await pool.query("SELECT NOW() as now, version() as version");
      console.log("✅ CONNECTED SUCCESSFULLY!");
      console.log("   Now:", res.rows[0].now);
      console.log("   Version:", res.rows[0].version.split("\n")[0]);
      await pool.end();
      return connStr;
    } catch (err: any) {
      console.error("❌ Connection failed:", err.message);
      await pool.end();
    }
  }
}

testPoolerConnection();
