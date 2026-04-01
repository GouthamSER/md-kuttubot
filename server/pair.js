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
const pn = require('awesome-phonenumber');

const router = express.Router();

function removeFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        fs.rmSync(filePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || 'session');

    await removeFile(dirs);
    num = num.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent)
            return res.status(400).send({ code: 'Invalid phone number. Enter your full international number (e.g., 919876543210) without + or spaces.' });
        return;
    }

    num = phone.getNumber('e164').replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();

            let sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    try {
                        const sessionData = fs.readFileSync(dirs + '/creds.json');
                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        await sock.sendMessage(userJid, {
                            document: sessionData,
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });

                        await sock.sendMessage(userJid, {
                            text: `⚠️ *Do not share this file with anybody* ⚠️\n\n┌┤🤖  MD-KuttuBot Session\n│└────────────────┈\n│ Upload creds.json to your\n│ bot's session/ folder\n└──────────────────┈\n\nPowered by *MD-KuttuBot*`
                        });

                        await delay(1000);
                        removeFile(dirs);
                    } catch (error) {
                        console.error('Error sending session:', error);
                        removeFile(dirs);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) initiateSession();
                }
            });

            if (!sock.authState.creds.registered) {
                await delay(3000);
                num = num.replace(/[^\d+]/g, '');
                if (num.startsWith('+')) num = num.substring(1);

                try {
                    let code = await sock.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) await res.send({ code });
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    if (!res.headersSent)
                        res.status(503).send({ code: 'Failed to get pairing code. Check your number and try again.' });
                }
            }

            sock.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) res.status(503).send({ code: 'Service Unavailable' });
        }
    }

    await initiateSession();
});

module.exports = router;
