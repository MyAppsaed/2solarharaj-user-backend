const nodemailer = require("nodemailer");

let transporter = nodemailer.createTransport({
  host: "smtp.oxcs.bluehost.com",
  port: 587,
  secure: false, // TLS requires false here
  auth: {
    user: "customer@solarharaj.com",
    pass: "Solar@112233",
  },
  tls: {
    rejectUnauthorized: false, // in case of self-signed cert issues
  },
});

transporter.sendMail(
  {
    from: '"Shamsi" <info@solarharaj.com>',
    to: "sudotahirsaeed@gmail.com",
    subject: "Test Email",
    text: "Hello from Bluehost SMTP + Nodemailer!",
  },
  (err, info) => {
    if (err) {
      console.error("Error: ", err);
    } else {
      console.log("Email sent: ", info.response);
    }
  }
);
