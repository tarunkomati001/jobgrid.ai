import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER!;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "")!;

export async function fetchLatest(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    socket.setEncoding("utf8");

    let buffer = "";
    let step = 0;

    socket.on("data", (chunk: string) => {
      buffer += chunk;

      if (step === 0 && buffer.includes("* OK")) {
        step = 1;
        buffer = "";
        socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
      } else if (step === 1 && buffer.includes("a001 OK")) {
        step = 2;
        buffer = "";
        socket.write(`a002 SELECT INBOX\r\n`);
      } else if (step === 2 && buffer.includes("a002 OK")) {
        step = 3;
        buffer = "";
        socket.write(`a003 SEARCH TEXT "Oracle"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        if (ids.length === 0) {
          socket.write("a999 LOGOUT\r\n");
          resolve(null);
          return;
        }

        const latestId = ids[ids.length - 1];
        step = 4;
        buffer = "";
        socket.write(`a004 FETCH ${latestId} (BODY[TEXT])\r\n`);
      } else if (step === 4 && buffer.includes("a004 OK")) {
        const regex = /(?:pass code|verification code|code)[:\s*]+(\d{6})/i;
        const match = buffer.match(regex);
        socket.write("a999 LOGOUT\r\n");
        if (match && match[1]) {
          console.log("SUCCESSFULLY EXTRACTED OTP:", match[1]);
          resolve(match[1]);
        } else {
          console.log("No match found in:", buffer.slice(0, 500));
          resolve(null);
        }
      }
    });

    socket.on("error", (e) => {
      console.error(e);
      resolve(null);
    });

    setTimeout(() => {
      socket.end();
      resolve(null);
    }, 10000);
  });
}

fetchLatest().then((otp) => {
  console.log("Result:", otp);
  process.exit(0);
});
