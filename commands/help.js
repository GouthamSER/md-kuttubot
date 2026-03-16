const settings = require('../settings');
const fs = require('fs');
const path = require('path');

async function helpCommand(sock, chatId, message) {
    const helpMessage = `
╔══════════════════════╗
   *🤖 ${settings.botName || settings.botName}*
   Version: *${settings.version || '3.0.0'}*
   by ${settings.botOwner || 'Mr Unique Hacker'}
╚══════════════════════╝

*Available Commands:*

╔══════════════════════╗
📡 *General*
║ ➤ .ping   — Bot speed & uptime
║ ➤ .alive  — Check bot status
║ ➤ .help   — Show this menu
║ ➤ .list   — Show this menu
║ ➤ .menu   — Show this menu
╚══════════════════════╝

╔══════════════════════╗
📥 *Downloader*
║ ➤ .play  <song name>   — Audio (MP3)
║ ➤ .song  <song name>   — Audio (MP3)
║ ➤ .mp3   <name/reply>  — YouTube/Video→MP3
║ ➤ .video <name/URL>    — Video (MP4)
║ ➤ .tomp3 <video/URL>   — Video → MP3
║ ➤ .insta <link(s)>     — Instagram post/reel
║ ➤ .story <@user/URL>   — Instagram stories
║ ➤ .fb    <link>        — Facebook video
║ ➤ .tiktok <link>       — TikTok video
║ ➤ .pinterest <query>   — Pinterest search
╚══════════════════════╝

╔══════════════════════╗
🔒 *Owner Commands*
║ ➤ .mode public   — Allow everyone
║ ➤ .mode private  — Owner only
╚══════════════════════╝

╔══════════════════════╗
👥 *Group Commands*
║ ➤ .tagall  — Mention all members
║             (Admin only)
╚══════════════════════╝

> Powered by *${settings.botName}*`;

    try {
        const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: settings.botName,
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: settings.botName,
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    }
}

module.exports = helpCommand;
