const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Create a transporter -- Service that sends email
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  // 2) Define email options
  const mailOptions = {
    from: 'Thomas Neos <tneos@yohoo.com',
    to: options.email, // recipient
    subject: options.subject,
    text: options.message,
  };
  // 3) Send email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
