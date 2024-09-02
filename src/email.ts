import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
})

export const sendCreateEmail = async (
    to: string,
    name: string,
    target: string,
    blinksUrl: string
) => {
    const emailTemplate = fs.readFileSync(path.join(__dirname, '../email/create.html'), 'utf-8');
    const template = Handlebars.compile(emailTemplate);
    const html = template({
        CAMPAIGN_NAME: name,
        FUNDING_GOAL: target,
        CAMPAIGN_URL: blinksUrl,
    })
    const info = await transporter.sendMail({
        from: `"MetaFundr 🤝" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Your Crowdfunding Campaign is Live!🚀",
        html
    });
    console.log(`Email sent: ${info.messageId}`);
}

export const sendTargetReachedMail = async (
    to: string,
    name: string,
    target: string,
    totalRaised: string,
    //donors: string,
    url: string
) => {
    const emailTemplate = fs.readFileSync(path.join(__dirname, '../email/target.html'), 'utf-8');
    const template = Handlebars.compile(emailTemplate);
    const html = template({
        campaignName: name,
        initialGoal: target,
        totalRaised: totalRaised,
        //numberOfBackers: donors,
        campaignUrl: url,
    })
    const info = await transporter.sendMail({
        from: `"MetaFundr 🤝" <${process.env.EMAIL_USER}>`,
        to,
        subject: "🎉 Goal Reached! 🎉",
        html
    });
    console.log(`Email sent: ${info.messageId}`);
}