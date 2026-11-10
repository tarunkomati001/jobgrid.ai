import imaps from "imap-simple";
import dotenv from "dotenv";
dotenv.config();

async function checkEmails() {
  const config = {
    imap: {
      user: process.env.GMAIL_USER || "tharunkomite7@gmail.com",
      password: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      authTimeout: 10000
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox("INBOX");
    const searchCriteria = ["UNSEEN"];
    const fetchOptions = { bodies: ["HEADER", "TEXT"], markSeen: false };
    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log("Unseen messages count:", messages.length);
    messages.forEach(m => {
      const header = m.parts.find(p => p.which === "HEADER");
      console.log("Subject:", header?.body?.subject?.[0]);
      console.log("From:", header?.body?.from?.[0]);
    });
    connection.end();
  } catch (err: any) {
    console.error("IMAP error:", err.message);
  }
}

checkEmails().catch(console.error);

