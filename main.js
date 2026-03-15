// MD-KuttuBot — Clean build

const fs = require('fs');
const path = require('path');

// Redirect temp storage
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP  = customTemp;
process.env.TMP   = customTemp;

// Auto-clean temp every 3 hours
setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000)
                    fs.unlink(filePath, () => {});
            });
        }
    });
    console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const { isSudo } = require('./lib/index');
const isOwnerOrSudo = require('./lib/isOwner');
const isAdmin = require('./lib/isAdmin');

// Command imports
const tagAllCommand    = require('./commands/tagall');
const helpCommand      = require('./commands/help');
const pingCommand      = require('./commands/ping');
const aliveCommand     = require('./commands/alive');
const { instagramCommand, storyCommand } = require('./commands/instagram');
const facebookCommand  = require('./commands/facebook');
const playCommand      = require('./commands/play');
const songCommand      = require('./commands/song');
const videoCommand     = require('./commands/video');

// Global settings
global.packname    = settings.packname;
global.author      = settings.author;
global.channelLink = 'https://whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A';
global.ytch        = 'Mr Unique Hacker';

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: settings.botName,
            serverMessageId: -1
        }
    }
};

async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        const chatId   = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup  = chatId.endsWith('@g.us');
        const senderIsSudo = await isSudo(senderId);
        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId);

        // Get message text
        const userMessage = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            ''
        ).toLowerCase().replace(/\.\s+/g, '.').trim();

        if (userMessage.startsWith('.'))
            console.log(`📝 Command: ${userMessage} | ${isGroup ? 'group' : 'private'}`);

        // Read bot mode
        let isPublic = true;
        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof data.isPublic === 'boolean') isPublic = data.isPublic;
        } catch (_) {}

        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;

        // Banned user check
        if (isBanned(senderId)) {
            if (Math.random() < 0.1)
                await sock.sendMessage(chatId, { text: '❌ You are banned from using this bot.', ...channelInfo });
            return;
        }

        // Ignore non-command messages
        if (!userMessage.startsWith('.')) return;

        // In private mode only owner/sudo can use commands
        if (!isPublic && !isOwnerOrSudoCheck) return;

        // Admin check for tagall
        const adminCommands = ['.tagall'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));
        let isSenderAdmin = false;
        let isBotAdmin    = false;

        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin    = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.', ...channelInfo }, { quoted: message });
                return;
            }
        }

        // ── Command Router ──────────────────────────────────────────
        switch (true) {

            // Help / Menu / List
            case userMessage === '.help' || userMessage === '.menu' || userMessage === '.list' || userMessage === '.bot':
                await helpCommand(sock, chatId, message);
                break;

            // Ping
            case userMessage === '.ping':
                await pingCommand(sock, chatId, message);
                break;

            // Alive
            case userMessage === '.alive':
                await aliveCommand(sock, chatId, message);
                break;

            // TagAll — group admin only
            case userMessage === '.tagall':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: '❌ .tagall can only be used in groups.', ...channelInfo }, { quoted: message });
                    break;
                }
                await tagAllCommand(sock, chatId, senderId, message);
                break;

            // Instagram downloader
            case userMessage.startsWith('.instagram') ||
                 userMessage.startsWith('.insta')     ||
                 userMessage === '.ig'                ||
                 userMessage.startsWith('.ig '):
                await instagramCommand(sock, chatId, message);
                break;

            // Story downloader
            case userMessage.startsWith('.story'):
                await storyCommand(sock, chatId, message);
                break;

            // Facebook downloader
            case userMessage.startsWith('.facebook') ||
                 userMessage.startsWith('.fb'):
                await facebookCommand(sock, chatId, message);
                break;

            // Play (audio via Keith API)
            case userMessage.startsWith('.music'):
                await playCommand(sock, chatId, message);
                break;

            // Song / Play / MP3 — multi-API audio downloader
            case userMessage.startsWith('.play')   ||
                 userMessage.startsWith('.song')   ||
                 userMessage.startsWith('.mp3')    ||
                 userMessage.startsWith('.ytmp3'):
                await songCommand(sock, chatId, message);
                break;

            // Video — YouTube MP4 downloader
            case userMessage.startsWith('.video')  ||
                 userMessage.startsWith('.ytmp4'):
                await videoCommand(sock, chatId, message);
                break;

            // Mode — switch public/private (owner only)
            case userMessage.startsWith('.mode'): {
                if (!message.key.fromMe && !senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '\u274c Only the bot owner can use .mode!', ...channelInfo }, { quoted: message });
                    break;
                }
                let modeData;
                try { modeData = JSON.parse(fs.readFileSync('./data/messageCount.json')); }
                catch (_) { modeData = {}; }

                const modeArg = userMessage.split(' ')[1]?.toLowerCase();

                if (!modeArg) {
                    const current = modeData.isPublic === false ? 'private' : 'public';
                    await sock.sendMessage(chatId, {
                        text: `\u2699\ufe0f *Bot Mode*\n\nCurrent mode: *${current}*\n\nUsage:\n\u2022 .mode public \u2014 allow everyone\n\u2022 .mode private \u2014 owner only`,
                        ...channelInfo
                    }, { quoted: message });
                    break;
                }

                if (modeArg !== 'public' && modeArg !== 'private') {
                    await sock.sendMessage(chatId, { text: '\u274c Invalid. Use: .mode public OR .mode private', ...channelInfo }, { quoted: message });
                    break;
                }

                modeData.isPublic = (modeArg === 'public');
                try {
                    fs.writeFileSync('./data/messageCount.json', JSON.stringify(modeData, null, 2));
                    const icon = modeArg === 'public' ? '\ud83c\udf10' : '\ud83d\udd12';
                    const desc = modeArg === 'public' ? 'Everyone can now use commands.' : 'Only owner/sudo can use commands.';
                    await sock.sendMessage(chatId, {
                        text: `\u2705 Bot mode set to *${modeArg}*\n\n${icon} ${desc}`,
                        ...channelInfo
                    }, { quoted: message });
                } catch (_) {
                    await sock.sendMessage(chatId, { text: '\u274c Failed to save mode. Check data folder.', ...channelInfo }, { quoted: message });
                }
                break;
            }

            // Unknown command
            default:
                // Silently ignore unknown commands
                break;
        }

    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        try {
            const chatId = messageUpdate?.messages?.[0]?.key?.remoteJid;
            if (chatId)
                await sock.sendMessage(chatId, { text: '❌ Failed to process command!', ...channelInfo });
        } catch (_) {}
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    // No group-event handlers in this minimal build
}

module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async () => {}   // No-op — autostatus removed
};
