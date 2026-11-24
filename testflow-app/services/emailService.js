const nodemailer = require('nodemailer');
const SystemConfig = require('../models/SystemConfig');
const { logger } = require('../utils/logger');
require('dotenv').config({ quiet: true }); // o aviso do dotenv não é JSON

let transporter = null;

const createTransporter = async () => {
    try {
        const config = await SystemConfig.findOne({ key: 'email_settings' });

        // Priority: DB > Env
        const host = config?.value?.host || process.env.SMTP_HOST;
        const port = config?.value?.port || process.env.SMTP_PORT;
        const secure = config?.value?.secure !== undefined ? config.value.secure : (process.env.SMTP_SECURE === 'true');
        const user = config?.value?.user || process.env.SMTP_USER;
        const pass = config?.value?.pass || process.env.SMTP_PASS;

        if (host) {
            const transportOptions = {
                host,
                port,
                secure
            };

            // Adiciona autenticação apenas se fornecida
            if (user) {
                transportOptions.auth = { user, pass };
            }

            transporter = nodemailer.createTransport(transportOptions, {
                from: config?.value?.from || user || 'noreply@testflow.local' // Default 'from' address
            });

            logger.info('Email: transporter inicializado', { source: config ? 'database' : 'environment' });
        } else {
            logger.warn('Email: servidor SMTP não configurado, nada será enviado');
            transporter = null;
        }
    } catch (err) {
        logger.error('Email: falha ao inicializar o transporter', { err });
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
        logger.info('Email enviado', { type });
    } catch (error) {
        logger.error('Email: falha no envio, salvando na fila', { type, err: error });

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
    const subject = 'Bem-vindo ao TestFlow - Ative sua conta';
    const firstName = name.split(' ')[0];

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao TestFlow</title>
        <!--[if mso]>
        <style>
            table {border-collapse: collapse;}
            td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif;}
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td align="center" style="background-color: #2563eb; padding: 30px;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Bem-vindo ao TestFlow, ${firstName}!</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Olá <strong>${name}</strong>,</p>
                                <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Sua conta foi criada com sucesso na plataforma de gestão de testes.</p>
                                
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 6px; margin-bottom: 30px;">
                                    <tr>
                                        <td style="padding: 15px; text-align: center;">
                                            <p style="margin: 0; font-size: 14px; color: #64748b;">Seu usuário de acesso:</p>
                                            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #0f172a;">${username}</p>
                                        </td>
                                    </tr>
                                </table>

                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-bottom: 30px;">
                                            <!--[if mso]>
                                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${setupLink}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="#2563eb">
                                            <w:anchorlock/>
                                            <center>
                                            <![endif]-->
                                                <a href="${setupLink}" style="background-color: #2563eb; color: #ffffff; display: inline-block; font-family: sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 240px; border-radius: 6px; -webkit-text-size-adjust: none;">
                                                    Definir Senha e Acessar
                                                </a>
                                            <!--[if mso]>
                                            </center>
                                            </v:roundrect>
                                            <![endif]-->
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="font-size: 14px; color: #64748b; margin: 0;">Este link é exclusivo para a configuração inicial da sua conta e expira em breve.</p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8;">TestFlow Quality Management - Developed by João Victor Melo</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
    await sendEmail(to, subject, html, 'invite');
};

const sendResetPasswordEmail = async (to, name, resetLink) => {
    const subject = 'Recuperação de Senha - TestFlow';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperação de Senha</title>
        <!--[if mso]>
        <style>
            table {border-collapse: collapse;}
            td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif;}
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td align="center" style="background-color: #dc2626; padding: 30px;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Recuperação de Senha</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Olá <strong>${name || 'Usuário'}</strong>,</p>
                                <p style="font-size: 16px; color: #333333; margin: 0 0 30px 0;">Recebemos uma solicitação para redefinir a senha da sua conta no TestFlow.</p>
                                
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-bottom: 30px;">
                                            <!--[if mso]>
                                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetLink}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="10%" stroke="f" fillcolor="#dc2626">
                                            <w:anchorlock/>
                                            <center>
                                            <![endif]-->
                                                <a href="${resetLink}" style="background-color: #dc2626; color: #ffffff; display: inline-block; font-family: sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 200px; border-radius: 6px; -webkit-text-size-adjust: none;">
                                                    Redefinir Senha
                                                </a>
                                            <!--[if mso]>
                                            </center>
                                            </v:roundrect>
                                            <![endif]-->
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="font-size: 14px; color: #64748b; margin: 0 0 10px 0;">Este link expira em 1 hora.</p>
                                <p style="font-size: 14px; color: #64748b; margin: 0;">Se você não solicitou esta alteração, por favor ignore este email.</p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8;">TestFlow Quality Management - Developed by João Victor Melo</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
    await sendEmail(to, subject, html, 'reset');
};

const processQueue = async () => {
    const transport = await getTransporter();

    if (!transport) {
        logger.warn('Email: fila não processada, transporter não está pronto');
        return;
    }

    const pendingEmails = await PendingEmail.find({ status: { $in: ['pending', 'failed'] }, attempts: { $lt: 5 } });

    if (pendingEmails.length === 0) {
        return;
    }

    logger.info('Email: processando a fila', { pending: pendingEmails.length });
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
            logger.info('Email da fila enviado', { type: email.type });
        } catch (err) {
            email.status = 'failed';
            email.attempts += 1;
            email.lastAttempt = Date.now();
            email.errorLog = err.message;
            await email.save();
            logger.error('Email da fila: falha no envio', { type: email.type, err });
        }
    }
};

const reloadConfig = async () => {
    await createTransporter();
    // Trigger queue processing on config reload
    processQueue();
};

module.exports = { sendInviteEmail, sendResetPasswordEmail, reloadConfig, processQueue };
