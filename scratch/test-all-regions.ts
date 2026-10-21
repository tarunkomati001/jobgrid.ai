import { Pool } from "pg";

const regions = [
  "ap-southeast-1", // Singapore
  "ap-south-1",     // Mumbai
  "us-east-1",      // N. Virginia
  "us-west-1",      // N. California
  "eu-west-1",      // Ireland
  "eu-central-1",   // Frankfurt
  "ap-northeast-1", // Tokyo
  "ap-southeast-2", // Sydney
  "sa-east-1"       // São Paulo
];

async function findRegion() {
  for (const reg of regions) {
    const connStr = `postgresql://postgres.ovewmitrxkzjxrmbhyyk:Tarunbabu%402006@aws-0-${reg}.pooler.supabase.com:6543/postgres`;
    console.log(`Checking region: ${reg}...`);
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });

    try {
      const res = await pool.query("SELECT NOW() as now");
      console.log(`🎉 SUCCESS! Region found: ${reg}`);
      console.log(`   Connected at: ${res.rows[0].now}`);
      console.log(`   ConnectionString: ${connStr}`);
      await pool.end();
      return connStr;
    } catch (err: any) {
      if (!err.message.includes("tenant/user postgres.ovewmitrxkzjxrmbhyyk not found")) {
        console.log(`   Message for ${reg}: ${err.message}`);
      }
      await pool.end();
    }
  }
}

findRegion();
