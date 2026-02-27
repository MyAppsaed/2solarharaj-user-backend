const twilio = require("twilio");

function sendSMS(to, message) {
  // Twilio credentials (from console)
  const accountSid = "";
  const authToken = "";
  const client = twilio(accountSid, authToken);

  client.messages
    .create({
      body: message,
      from: "+967783990304", // Twilio verified number
      to: to, // Recipient (e.g., +967XXXXXXXXX for Yemen)
    })
    .then((msg) => console.log("SMS sent with SID:", msg.sid))
    .catch((err) => console.error("SMS failed:", err));
}

// Example usage
sendSMS("+967771070355", "Hello from Tahir if you receive reply on whatsapp!");
