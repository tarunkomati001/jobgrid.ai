import { Pool } from "pg";
import dns from "dns";

const poolerHost = "aws-0-ap-northeast-2.pooler.supabase.com";

console.log(`1. Testing DNS resolution for Supabase Seoul Pooler host: ${poolerHost}...`);

dns.lookup(poolerHost, async (err, address, family) => {
  if (err) {
    console.error(`❌ DNS lookup failed for ${poolerHost}:`, err.message);
    return;
  }
  console.log(`✅ Host ${poolerHost} resolved to IP: ${address} (IPv${family})`);

  // Test Pooler connection strings
  const connectionStrings = [
    "postgresql://postgres.ovewmitrxkzjxrmbhyyk:Tarunbabu%402006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
    "postgresql://postgres.ovewmitrxkzjxrmbhyyk:Tarunbabu%402006@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
    "postgresql://postgres:Tarunbabu%402006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?options=project%3Dovewmitrxkzjxrmbhyyk",
    "postgresql://postgres:Tarunbabu%402006@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?options=project%3Dovewmitrxkzjxrmbhyyk"
  ];

  for (const connStr of connectionStrings) {
    console.log(`\n2. Testing connection string: ${connStr.replace(/Tarunbabu%402006/g, "*****")}`);
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      const res = await pool.query("SELECT CURRENT_TIMESTAMP as now, version() as version");
      console.log("===============================================================================");
      console.log("🎉 CONNECTED SUCCESSFULLY TO SUPABASE POOLER (Seoul ap-northeast-2)!");
      console.log("   Server Time:", res.rows[0].now);
      console.log("   PostgreSQL Version:", res.rows[0].version.split("\n")[0]);
      console.log("===============================================================================");
      await pool.end();
      return;
    } catch (connErr: any) {
      console.error("❌ Connection failed:", connErr.message);
      await pool.end();
    }
  }
});
