const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const SystemConfig = require('../models/SystemConfig');
require('dotenv').config();

let transporter = null;

// Log function to 'email.log' in project root
const logEmail = (status, details) => {
    const logPath = path.join(__dirname, '..', 'email.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${status}] ${details}\n`;

    fs.appendFile(logPath, logMessage, (err) => {
        if (err) console.error("Failed to write to email.log:", err);
    });
};

const createTransporter = async () => {
    try {
        const config = await SystemConfig.findOne({ key: 'email_settings' });

        // Priority: DB > Env
        const host = config?.value?.host || process.env.SMTP_HOST;
        const port = config?.value?.port || process.env.SMTP_PORT;
        const secure = config?.value?.secure !== undefined ? config.value.secure : (process.env.SMTP_SECURE === 'true');
        const user = config?.value?.user || process.env.SMTP_USER;
        const pass = config?.value?.pass || process.env.SMTP_PASS;

        if (host && user && pass) {
            transporter = nodemailer.createTransport({
                host,
                port,
                secure,
                auth: { user, pass }
            });
            logEmail('INFO', `Transporter initialized. Source: ${config ? 'Database' : 'Environment'}`);
            console.log("Email Service: Transporter Initialized");
        } else {
            logEmail('WARN', 'Missing configuration. Emails will not be sent.');
            console.warn("Email Service: Missing configuration.");
            transporter = null;
        }
    } catch (err) {
        logEmail('ERROR', `Failed to initialize transporter: ${err.message}`);
        console.error("Email Service: Failed to initialize transporter", err);
    }
};

const getTransporter = async () => {
    if (!transporter) await createTransporter();
    return transporter;
};

const getFromEmail = async () => {
    const config = await SystemConfig.findOne({ key: 'email_settings' });
    return config?.value?.from || process.env.EMAIL_FROM;
}

const PendingEmail = require('../models/PendingEmail');

const sendEmail = async (to, subject, html, type = 'generic') => {
    const transport = await getTransporter();

    // Internal function to attempt sending
    const attemptSend = async () => {
        if (!transport) throw new Error('Transporter not initialized');
        const from = await getFromEmail();
        await transport.sendMail({ from, to, subject, html });
    };

    try {
        await attemptSend();
        logEmail('SENT', `${type} email sent to ${to}`);
        console.log(`Email (${type}) enviado para ${to}`);
    } catch (error) {
        logEmail('ERROR', `Failed to send ${type} email to ${to}: ${error.message}. Queuing...`);
        console.error(`Erro ao enviar email (${type}). Salvando na fila:`, error.message);

        // Queue the email
        await PendingEmail.create({
            to,
            subject,
            html,
            type,
            status: 'pending',
            errorLog: error.message
        });
    }
};

const sendInviteEmail = async (to, username, name, setupLink) => {
    console.log(`[DEBUG_SERVICE] sendInviteEmail called for ${to}`);
    const subject = 'Bem-vindo ao TestFlow - Ative sua conta';
    // Use first name for greeting
    const firstName = name.split(' ')[0];

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Bem-vindo ao TestFlow, ${firstName}!</h1>
            </div>
            <div style="padding: 30px;">
                <p style="font-size: 16px; color: #333333;">Olá <strong>${name}</strong>,</p>
                <p style="font-size: 16px; color: #333333;">Sua conta foi criada com sucesso.</p>
                <p style="font-size: 16px; color: #333333;"><strong>Usuário:</strong> ${username}</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${setupLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Definir Senha e Acessar</a>
                </div>
                <p style="font-size: 14px; color: #666666;">Este link é exclusivo para a configuração inicial da sua conta.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #999999; text-align: center;">TestFlow - Gestão de Testes</p>
            </div>
        </div>
    `;
    await sendEmail(to, subject, html, 'invite');
};

const sendResetPasswordEmail = async (to, name, resetLink) => {
    const subject = 'Recuperação de Senha - TestFlow';
    const firstName = name ? name.split(' ')[0] : 'Usuário';

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Recuperação de Senha</h1>
            </div>
            <div style="padding: 30px;">
                <p style="font-size: 16px; color: #333333;">Olá <strong>${name || 'Usuário'}</strong>,</p>
                <p style="font-size: 16px; color: #333333;">Você solicitou a redefinição de sua senha.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Redefinir Senha</a>
                </div>
                <p style="font-size: 14px; color: #666666;">Este link expira em 1 hora.</p>
                <p style="font-size: 14px; color: #666666;">Se você não solicitou isso, ignore este email.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #999999; text-align: center;">TestFlow - Gestão de Testes</p>
            </div>
        </div>
    `;
    await sendEmail(to, subject, html, 'reset');
};

const processQueue = async () => {
    logEmail('INFO', 'Processing email queue...');
    const transport = await getTransporter();

    if (!transport) {
        logEmail('WARN', 'Cannot process queue: Transporter not ready');
        console.log('Fila de email não processada: Transporter não pronto.');
        return;
    }

    const pendingEmails = await PendingEmail.find({ status: { $in: ['pending', 'failed'] }, attempts: { $lt: 5 } });

    if (pendingEmails.length === 0) {
        logEmail('INFO', 'Queue is empty.');
        return;
    }

    console.log(`Processando ${pendingEmails.length} emails pendentes...`);
    const from = await getFromEmail();

    for (const email of pendingEmails) {
        try {
            await transport.sendMail({
                from,
                to: email.to,
                subject: email.subject,
                html: email.html
            });

            email.status = 'sent';
            email.lastAttempt = Date.now();
            await email.save();
            logEmail('SENT_QUEUE', `Queued ${email.type} email sent to ${email.to}`);
        } catch (err) {
            email.status = 'failed';
            email.attempts += 1;
            email.lastAttempt = Date.now();
            email.errorLog = err.message;
            await email.save();
            logEmail('ERROR_QUEUE', `Failed to send queued email to ${email.to}: ${err.message}`);
        }
    }
};

const reloadConfig = async () => {
    logEmail('INFO', 'Reloading configuration requested.');
    await createTransporter();
    // Trigger queue processing on config reload
    processQueue();
};

module.exports = { sendInviteEmail, sendResetPasswordEmail, reloadConfig, processQueue };
