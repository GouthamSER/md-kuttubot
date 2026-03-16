const settings = require('../settings');
const axios = require('axios');
const { cleanTemp } = require('../lib/cleanTemp');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*'
};

// Pinterest search API
async function pinterestSearch(query, count = 5) {
    try {
        const res = await axios.get(
            `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/pins/?q=${encodeURIComponent(query)}&data={"options":{"isPrefetch":false,"query":"${encodeURIComponent(query)}","scope":"pins","no_fetch_context_on_resource":false},"context":{}}`,
            { 
                timeout: 15000, 
                headers: {
                    ...HEADERS,
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );

        const results = res.data?.resource_response?.data?.results || [];
        const imageUrls = results
            .slice(0, count)
            .map(item => item?.images?.orig?.url)
            .filter(url => url);

        return imageUrls.length ? imageUrls : null;
    } catch (e) {
        console.error('[PINTEREST] Search failed:', e.message);
        return null;
    }
}

// Pinterest video downloader API
async function pinterestDownload(url) {
    try {
        const res = await axios.get(
            `https://www.pinterest.com/resource/PinResource/get/?source_url=${encodeURIComponent(url)}&data={"options":{"field_set_key":"unauth_react_main_pin"},"context":{}}`,
            {
                timeout: 15000,
                headers: {
                    ...HEADERS,
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );

        const pinData = res.data?.resource_response?.data;
        if (!pinData) throw new Error('No pin data found');

        // Check for video
        if (pinData.videos?.video_list) {
            const videoList = pinData.videos.video_list;
            const videoUrl = videoList.V_720P?.url || 
                           videoList.V_HLSV4?.url || 
                           videoList.V_HLSV3?.url || 
                           Object.values(videoList)[0]?.url;
            
            if (videoUrl) return { url: videoUrl, type: 'video' };
        }

        // Fallback to image
        const imageUrl = pinData.images?.orig?.url;
        if (imageUrl) return { url: imageUrl, type: 'image' };

        throw new Error('No media found');
    } catch (e) {
        console.error('[PINTEREST] Download failed:', e.message);
        return null;
    }
}

async function pinterestCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const replyText = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
        let userQuery = text.split(' ').slice(1).join(' ').trim() || replyText;

        if (!userQuery) {
            await sock.sendMessage(chatId, {
                text: `📌 *Pinterest Downloader*\n\n*Usage:*\n• .pinterest <search term>\n• .pinterest <search term>, <count>\n• .pinterest <Pinterest link>\n\n*Examples:*\n• .pinterest nature wallpaper\n• .pinterest cars, 10\n• .pinterest https://pin.it/xxxxx`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Check if URL
        const urlMatch = userQuery.match(/\bhttps?:\/\/\S+/gi);
        
        if (urlMatch) {
            // Download from URL
            const pinUrl = urlMatch[0];
            const result = await pinterestDownload(pinUrl);

            if (!result) {
                await sock.sendMessage(chatId, {
                    text: '❌ Could not download from Pinterest link.\n\nMake sure the link is valid and public.'
                }, { quoted: message });
                cleanTemp();
                return;
            }

            if (result.type === 'video') {
                await sock.sendMessage(chatId, {
                    video: { url: result.url },
                    mimetype: 'video/mp4',
                    caption: `📌 _Downloaded by ${settings.botName}_`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: { url: result.url },
                    caption: `📌 _Downloaded by ${settings.botName}_`
                }, { quoted: message });
            }

        } else {
            // Search Pinterest
            const parts = userQuery.split(',');
            const searchQuery = parts[0].trim();
            const count = parseInt(parts[1]) || 5;

            if (count > 20) {
                await sock.sendMessage(chatId, {
                    text: '❌ Maximum 20 images allowed!'
                }, { quoted: message });
                return;
            }

            const results = await pinterestSearch(searchQuery, count);

            if (!results || !results.length) {
                await sock.sendMessage(chatId, {
                    text: `❌ No results found for: ${searchQuery}`
                }, { quoted: message });
                cleanTemp();
                return;
            }

            await sock.sendMessage(chatId, {
                text: `📌 Downloading ${results.length} image(s) for "${searchQuery}"...`
            }, { quoted: message });

            // Send images one by one
            for (let i = 0; i < results.length; i++) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: results[i] },
                        caption: i === 0 ? `📌 _${searchQuery} - ${results.length} results_` : undefined
                    }, { quoted: message });

                    if (i < results.length - 1) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (e) {
                    console.error(`[PINTEREST] Error sending image ${i + 1}:`, e.message);
                }
            }
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        cleanTemp();

    } catch (error) {
        console.error('[PINTEREST] Error:', error.message);
        cleanTemp();
        await sock.sendMessage(chatId, {
            text: '❌ Failed to process Pinterest request. Please try again.'
        }, { quoted: message });
    }
}

module.exports = pinterestCommand;
