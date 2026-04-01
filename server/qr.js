const express = require('express');
const fs = require('fs');
const pino = require('pino');
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

const router = express.Router();

function removeFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        fs.rmSync(filePath, { recursive: true, force: true });
        return true;
    } catch (e) {
        console.error('Error removing file:', e);
        return false;
    }
}

router.get('/', async (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const dirs = `./qr_sessions/session_${sessionId}`;

    if (!fs.existsSync('./qr_sessions')) fs.mkdirSync('./qr_sessions', { recursive: true });

    async function initiateSession() {
        if (!fs.existsSync(dirs)) fs.mkdirSync(dirs, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();

            let qrGenerated = false;
            let responseSent = false;

            const handleQRCode = async (qr) => {
                if (qrGenerated || responseSent) return;
                qrGenerated = true;

                try {
                    const qrDataURL = await QRCode.toDataURL(qr, {
                        errorCorrectionLevel: 'M',
                        type: 'image/png',
                        quality: 0.92,
                        margin: 1,
                        color: { dark: '#000000', light: '#FFFFFF' }
                    });

                    if (!responseSent) {
                        responseSent = true;
                        await res.send({
                            qr: qrDataURL,
                            message: 'QR Code Generated! Scan with WhatsApp.',
                            instructions: [
                                '1. Open WhatsApp on your phone',
                                '2. Go to Settings > Linked Devices',
                                '3. Tap "Link a Device"',
                                '4. Scan the QR code above'
                            ]
                        });
                    }
                } catch (qrError) {
                    console.error('Error generating QR code:', qrError);
                    if (!responseSent) {
                        responseSent = true;
                        res.status(500).send({ code: 'Failed to generate QR code' });
                    }
                }
            };

            const socketConfig = {
                version,
                logger: pino({ level: 'silent' }),
                browser: Browsers.windows('Chrome'),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            };

            let sock = makeWASocket(socketConfig);
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 3;

            const handleConnectionUpdate = async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr && !qrGenerated) await handleQRCode(qr);

                if (connection === 'open') {
                    reconnectAttempts = 0;
                    try {
                        const sessionData = fs.readFileSync(dirs + '/creds.json');
                        const userJid = Object.keys(sock.authState.creds.me || {}).length > 0
                            ? jidNormalizedUser(sock.authState.creds.me.id)
                            : null;

                        if (userJid) {
                            await sock.sendMessage(userJid, {
                                document: sessionData,
                                mimetype: 'application/json',
                                fileName: 'creds.json'
                            });

                            await sock.sendMessage(userJid, {
                                text: `⚠️ *Do not share this file with anybody* ⚠️\n\n┌┤🤖  MD-KuttuBot Session\n│└────────────────┈\n│ Upload creds.json to your\n│ bot's session/ folder\n└──────────────────┈\n\nPowered by *MD-KuttuBot*`
                            });
                        }
                    } catch (error) {
                        console.error('Error sending session file:', error);
                    }

                    setTimeout(() => { removeFile(dirs); }, 15000);
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === 401) {
                        removeFile(dirs);
                    } else if (statusCode === 515 || statusCode === 503) {
                        reconnectAttempts++;
                        if (reconnectAttempts <= maxReconnectAttempts) {
                            setTimeout(() => {
                                try {
                                    sock = makeWASocket(socketConfig);
                                    sock.ev.on('connection.update', handleConnectionUpdate);
                                    sock.ev.on('creds.update', saveCreds);
                                } catch (err) {
                                    console.error('Failed to reconnect:', err);
                                }
                            }, 2000);
                        } else {
                            if (!responseSent) {
                                responseSent = true;
                                res.status(503).send({ code: 'Connection failed after multiple attempts' });
                            }
                        }
                    }
                }
            };

            sock.ev.on('connection.update', handleConnectionUpdate);
            sock.ev.on('creds.update', saveCreds);

            // Timeout if no QR generated in 30s
            setTimeout(() => {
                if (!responseSent) {
                    responseSent = true;
                    res.status(408).send({ code: 'QR generation timeout. Please try again.' });
                    removeFile(dirs);
                }
            }, 30000);

        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) res.status(503).send({ code: 'Service Unavailable' });
            removeFile(dirs);
        }
    }

    await initiateSession();
});

module.exports = router;
