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

// Check for URL redirects (handle share links)
async function checkRedirect(url) {
    try {
        let splitUrl = url.split('/');
        if (splitUrl.includes('share')) {
            const res = await axios.get(url, { maxRedirects: 5, timeout: 10000 });
            return res.request.res.responseUrl || url;
        }
        return url;
    } catch (e) {
        return url;
    }
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
        const replyText = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
        let mediaLinks = text || replyText;

        if (!mediaLinks) {
            await sock.sendMessage(chatId, {
                text: `📸 *Instagram Downloader*\n\n*Usage:*\n• .insta <link>\n• .insta <link1> <link2> ...\n• Reply to message with links\n\n_Supports posts, reels, stories & carousels_`
            }, { quoted: message });
            return;
        }

        // Extract all URLs from the text
        const allUrls = mediaLinks.match(/\bhttps?:\/\/\S+/gi) || [];
        if (!allUrls.length) {
            await sock.sendMessage(chatId, { text: '❌ No Instagram links found!' }, { quoted: message });
            return;
        }

        // Filter and validate Instagram URLs
        const instagramUrls = [];
        const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|s|reel|tv)\/[\w-]+/i;

        for (let url of allUrls) {
            // Skip non-Instagram URLs
            if (url.includes('gist') || url.includes('youtu')) continue;
            
            // Handle redirects
            url = await checkRedirect(url);
            
            // Skip stories (handled by .story command)
            if (url.includes('stories')) continue;
            
            // Validate Instagram URL
            if (!url.includes('instagram.com')) continue;
            
            if (instagramRegex.test(url)) {
                const mediaId = url.match(/\/([\w-]+)\/?$/)?.[1];
                // Skip private accounts (very long IDs)
                if (mediaId && mediaId.length > 20) continue;
                
                instagramUrls.push(url);
            }
        }

        if (!instagramUrls.length) {
            await sock.sendMessage(chatId, { text: '❌ No valid Instagram links found!' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const allMediaItems = [];
        
        // Download from all URLs
        for (const url of instagramUrls) {
            try {
                const downloadData = await igdl(url);
                
                if (downloadData?.data?.length) {
                    const seenUrls = new Set();
                    const mediaList = downloadData.data
                        .filter(m => m?.url && !seenUrls.has(m.url) && seenUrls.add(m.url))
                        .slice(0, 10) // Limit per post
                        .map(m => ({
                            url: m.url,
                            type: m.type || (/\.(mp4|mov|webm)$/i.test(m.url) || url.includes('/reel/') || url.includes('/tv/') ? 'video' : 'image')
                        }));
                    
                    allMediaItems.push(...mediaList);
                }
            } catch (err) {
                console.error('Error downloading from:', url, err?.message);
            }
        }

        if (!allMediaItems.length) {
            await sock.sendMessage(chatId, { 
                text: '❌ No media found. Posts may be private or links invalid.' 
            }, { quoted: message });
            cleanTemp();
            return;
        }

        // Send status
        await sock.sendMessage(chatId, { 
            text: `📥 Downloading ${allMediaItems.length} item(s)...` 
        }, { quoted: message });

        // Send all media
        await sendMediaList(sock, chatId, message, allMediaItems);

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        cleanTemp();

    } catch (error) {
        console.error('Instagram command error:', error.message);
        cleanTemp();
        await sock.sendMessage(chatId, { text: '❌ Failed to download. Please try again.' }, { quoted: message });
    }
}

// ── .story ────────────────────────────────────────────────────────────────────
async function storyCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const replyText = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
        let userIdentifier = text.split(' ').slice(1).join(' ').trim() || replyText;

        // Skip if it's a post/reel link
        if (userIdentifier && (
            userIdentifier.includes('/reel/') || 
            userIdentifier.includes('/tv/') || 
            userIdentifier.includes('/p/')
        )) {
            return;
        }

        if (!userIdentifier) {
            await sock.sendMessage(chatId, {
                text: `📸 *Instagram Stories*\n\n*Usage:*\n• .story <username>\n• .story <story link>\n\n_Downloads all available stories_`
            }, { quoted: message });
            return;
        }

        // Convert username to story URL if needed
        if (!/\bhttps?:\/\/\S+/gi.test(userIdentifier)) {
            userIdentifier = `https://instagram.com/stories/${userIdentifier}/`;
        } else {
            userIdentifier = userIdentifier.match(/\bhttps?:\/\/\S+/gi)[0];
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const storyData = await igdl(userIdentifier);
        
        if (!storyData?.data?.length) {
            await sock.sendMessage(chatId, { text: '❌ No stories found or user has no active stories.' }, { quoted: message });
            cleanTemp();
            return;
        }

        const mediaList = storyData.data.map(m => ({
            url: m.url,
            type: /\.(mp4|mov|webm)$/i.test(m.url) ? 'video' : 'image'
        }));

        await sock.sendMessage(chatId, { 
            text: `📥 Downloading ${mediaList.length} stor${mediaList.length === 1 ? 'y' : 'ies'}...` 
        }, { quoted: message });

        await sendMediaList(sock, chatId, message, mediaList, 'story');

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        cleanTemp();

    } catch (error) {
        console.error('Story command error:', error.message);
        cleanTemp();
        await sock.sendMessage(chatId, { text: '❌ Failed to download stories. User may be private or has no stories.' }, { quoted: message });
    }
}

module.exports = { instagramCommand, storyCommand };

