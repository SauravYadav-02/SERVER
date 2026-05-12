import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "ysaurav262002@gmail.com",
        pass: "iink zbsd qgon bksi"
    }
});

export const sendEmail = async (to, subject, text) => {
    await transporter.sendMail({
        from: "ysaurav262002@gmail.com",
        to,
        subject,
        text
    });
};