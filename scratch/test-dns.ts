import dns from "dns";
import { config } from "../src/config";

console.log("Testing DNS resolution for:", config.dbUrl);

const host = "db.ovewmitrxkzjxrmbhyyk.supabase.co";
dns.lookup(host, (err, address, family) => {
  if (err) {
    console.error(`❌ DNS lookup failed for ${host}:`, err.message);
  } else {
    console.log(`✅ Host ${host} resolved to IP: ${address} (IPv${family})`);
  }
});

const poolerHost = "aws-0-ap-south-1.pooler.supabase.com";
dns.lookup(poolerHost, (err, address, family) => {
  if (err) {
    console.error(`❌ DNS lookup failed for ${poolerHost}:`, err.message);
  } else {
    console.log(`✅ Pooler Host ${poolerHost} resolved to IP: ${address} (IPv${family})`);
  }
});
