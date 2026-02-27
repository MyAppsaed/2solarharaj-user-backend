
const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Change to your email service (gmail, outlook, etc.)
  auth: {
    user: 'saedserv@gmail.com', // Replace with your email
    pass: 'tlme gwbw lklu hoyh' // Replace with your app password
  }
});


async function sendEmail(to, content, subject = 'SHAMSI - Verification Code') {
  try {
    // Email options
    const mailOptions = {
      from: 'saedserv@gmail.com', // Replace with your email
      to: to,
      subject: subject,
      text: content, // Plain text body
      html: `<p>${content.replace(/\n/g, '<br>')}</p>` // HTML body (converts newlines to <br>)
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    // console.log('Email sent successfully!');
    // console.log('Message ID:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
    
  } catch (error) {
    console.error('Error sending email:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports =  sendEmail ;

