import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER || "babufakemail@gmail.com";
const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
socket.setEncoding("utf8");

let buffer = "";
let step = 0;

socket.on("data", (chunk: string) => {
  buffer += chunk;
  if (step === 0 && buffer.includes("* OK")) {
    step = 1; buffer = "";
    socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
  } else if (step === 1 && buffer.includes("a001 OK")) {
    step = 2; buffer = "";
    socket.write(`a002 SELECT INBOX\r\n`);
  } else if (step === 2 && buffer.includes("a002 OK")) {
    step = 3; buffer = "";
    socket.write(`a003 FETCH 1615 (BODY[TEXT])\r\n`);
  } else if (step === 3 && buffer.includes("a003 OK")) {
    console.log("=== BODY OF 1615 ===");
    console.log(buffer);
    socket.write("a999 LOGOUT\r\n");
    setTimeout(() => { socket.end(); process.exit(0); }, 500);
  }
});

setTimeout(() => { socket.end(); process.exit(0); }, 10000);

