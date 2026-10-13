import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

console.log(`Testing IMAP connection for: ${user} with pass length: ${pass?.length}...`);

async function testImap() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false }, () => {
      console.log("Connected to imap.gmail.com:993 via TLS");
    });

    socket.setEncoding("utf8");

    let step = 0;
    socket.on("data", (data: string) => {
      console.log("IMAP <<<", data.trim());

      if (step === 0 && data.includes("* OK")) {
        step = 1;
        const cmd = `a001 LOGIN ${user} ${pass}\r\n`;
        console.log("IMAP >>> a001 LOGIN [REDACTED]");
        socket.write(cmd);
      } else if (step === 1) {
        if (data.includes("a001 OK")) {
          console.log("🎉 IMAP LOGIN SUCCESSFUL!");
          socket.write("a002 EXAMINE INBOX\r\n");
          step = 2;
        } else if (data.includes("a001 NO") || data.includes("a001 BAD")) {
          console.error("❌ IMAP LOGIN FAILED:", data.trim());
          socket.end();
          resolve(false);
        }
      } else if (step === 2) {
        if (data.includes("a002 OK")) {
          console.log("Inbox examined successfully!");
          socket.write("a003 LOGOUT\r\n");
          resolve(true);
        }
      }
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
      reject(err);
    });

    setTimeout(() => {
      socket.end();
      resolve(false);
    }, 15000);
  });
}

testImap().then((res) => {
  console.log("Test finished with result:", res);
  process.exit(0);
});
