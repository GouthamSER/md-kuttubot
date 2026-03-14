const { igdl } = require('ruhend-scraper');
const { cleanTemp } = require('../lib/cleanTemp');

// Track processed message IDs to prevent duplicate sends
const processedMessages = new Set();

async function instagramCommand(sock, chatId, message) {
    try {
        // Deduplicate
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

        if (!text) {
            await sock.sendMessage(chatId, { text: '📸 Usage: .insta <Instagram link>' }, { quoted: message });
            return;
        }

        const igPattern = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//;
        if (!igPattern.test(text)) {
            await sock.sendMessage(chatId, { text: '❌ Invalid Instagram link. Please send a valid post, reel or video URL.' }, { quoted: message });
            return;
        }

        // React to show processing
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const downloadData = await igdl(text);

        if (!downloadData?.data?.length) {
            await sock.sendMessage(chatId, { text: '❌ No media found. The post may be private or the link is invalid.' }, { quoted: message });
            cleanTemp();
            return;
        }

        // Deduplicate URLs
        const seenUrls  = new Set();
        const mediaList = downloadData.data
            .filter(m => m?.url && !seenUrls.has(m.url) && seenUrls.add(m.url))
            .slice(0, 20); // cap at 20

        if (!mediaList.length) {
            await sock.sendMessage(chatId, { text: '❌ No valid media URLs found.' }, { quoted: message });
            cleanTemp();
            return;
        }

        // Send each media item
        for (let i = 0; i < mediaList.length; i++) {
            try {
                const media   = mediaList[i];
                const mediaUrl = media.url;

                const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) ||
                                media.type === 'video' ||
                                text.includes('/reel/') ||
                                text.includes('/tv/');

                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video: { url: mediaUrl },
                        mimetype: 'video/mp4',
                        caption: '📥 _Downloaded by Knight Bot_'
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaUrl },
                        caption: '📥 _Downloaded by Knight Bot_'
                    }, { quoted: message });
                }

                // Small delay between multiple items to avoid rate limiting
                if (i < mediaList.length - 1)
                    await new Promise(r => setTimeout(r, 1000));

            } catch (mediaErr) {
                console.error(`Error sending media item ${i + 1}:`, mediaErr.message);
                // Continue to next item
            }
        }

        // ✅ React success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        // 🧹 Clean temp immediately after all items sent
        cleanTemp();

    } catch (error) {
        console.error('Instagram command error:', error);
        // 🧹 Clean temp even on error
        cleanTemp();
        await sock.sendMessage(chatId, { text: '❌ Failed to download. Please try again.' }, { quoted: message });
    }
}

module.exports = instagramCommand;
