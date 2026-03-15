const settings = require('../settings');
const { igdl }  = require('ruhend-scraper');
const axios     = require('axios');
const { cleanTemp } = require('../lib/cleanTemp');

// Track processed message IDs to prevent duplicate sends
const processedMessages = new Set();

function dedup(msgId) {
    if (processedMessages.has(msgId)) return false;
    processedMessages.add(msgId);
    setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);
    return true;
}

// ── Shared: send a list of media items ───────────────────────────────────────
async function sendMediaList(sock, chatId, message, mediaList, label) {
    for (let i = 0; i < mediaList.length; i++) {
        try {
            const { url, type } = mediaList[i];
            const isVideo = type === 'video' ||
                            /\.(mp4|mov|avi|mkv|webm)$/i.test(url) ||
                            label === 'story_video';

            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video: { url },
                    mimetype: 'video/mp4',
                    caption: `📥 _Downloaded by ${settings.botName}_`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: { url },
                    caption: `📥 _Downloaded by ${settings.botName}_`
                }, { quoted: message });
            }

            if (i < mediaList.length - 1)
                await new Promise(r => setTimeout(r, 1000));

        } catch (e) {
            console.error(`Error sending item ${i + 1}:`, e.message);
        }
    }
}

// ── .insta / .instagram ──────────────────────────────────────────────────────
async function instagramCommand(sock, chatId, message) {
    try {
        if (!dedup(message.key.id)) return;

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

        if (!text) {
            await sock.sendMessage(chatId, {
                text: `📸 *Usage:* .insta <Instagram link>\n\n_Supports posts, reels, carousels & videos_`
            }, { quoted: message });
            return;
        }

        if (!/https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//.test(text)) {
            await sock.sendMessage(chatId, { text: '❌ Invalid Instagram link.' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const downloadData = await igdl(text);

        if (!downloadData?.data?.length) {
            await sock.sendMessage(chatId, { text: '❌ No media found. The post may be private or the link is invalid.' }, { quoted: message });
            cleanTemp();
            return;
        }

        // Deduplicate URLs
        const seenUrls = new Set();
        const mediaList = downloadData.data
            .filter(m => m?.url && !seenUrls.has(m.url) && seenUrls.add(m.url))
            .slice(0, 20)
            .map(m => ({
                url: m.url,
                type: m.type || (/\.(mp4|mov|webm)$/i.test(m.url) || text.includes('/reel/') || text.includes('/tv/') ? 'video' : 'image')
            }));

        if (!mediaList.length) {
            await sock.sendMessage(chatId, { text: '❌ No valid media found.' }, { quoted: message });
            cleanTemp();
            return;
        }

        await sendMediaList(sock, chatId, message, mediaList);

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        cleanTemp();

    } catch (error) {
        console.error('Instagram command error:', error.message);
        cleanTemp();
        await sock.sendMessage(chatId, { text: '❌ Failed to download. Please try again.' }, { quoted: message });
    }
}

module.exports = { instagramCommand };
