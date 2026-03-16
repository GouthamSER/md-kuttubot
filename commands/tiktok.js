const settings = require('../settings');
const axios = require('axios');
const { cleanTemp } = require('../lib/cleanTemp');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*'
};

// TikTok downloader API functions
async function tiktokAPI1(url) {
    const res = await axios.get(
        `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
        { timeout: 15000, headers: HEADERS }
    );
    const video = res.data?.video?.noWatermark || res.data?.video?.watermark;
    if (!video) throw new Error('TiklyDown: no video URL');
    return { url: video, title: res.data?.title || 'TikTok Video' };
}

async function tiktokAPI2(url) {
    const res = await axios.get(
        `https://api.tiklydown.link/api/download?url=${encodeURIComponent(url)}`,
        { timeout: 15000, headers: HEADERS }
    );
    const video = res.data?.video?.noWatermark || res.data?.video?.watermark;
    if (!video) throw new Error('TiklyDown Link: no video URL');
    return { url: video, title: res.data?.title || 'TikTok Video' };
}

async function tiktokAPI3(url) {
    const res = await axios.post(
        'https://www.tikwm.com/api/',
        { url: url },
        { timeout: 15000, headers: { ...HEADERS, 'Content-Type': 'application/json' } }
    );
    const data = res.data?.data;
    if (!data?.play) throw new Error('Tikwm: no video URL');
    return { 
        url: data.play, 
        title: data.title || 'TikTok Video',
        author: data.author?.unique_id || 'Unknown'
    };
}

async function tiktokAPI4(url) {
    const res = await axios.get(
        `https://api.snaptik.site/api/download?url=${encodeURIComponent(url)}`,
        { timeout: 15000, headers: HEADERS }
    );
    const video = res.data?.result?.video || res.data?.data?.video;
    if (!video) throw new Error('SnapTik: no video URL');
    return { url: video, title: res.data?.title || 'TikTok Video' };
}

async function tiktokCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const replyText = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
        let videoLink = text.split(' ').slice(1).join(' ').trim() || replyText;

        if (!videoLink) {
            await sock.sendMessage(chatId, {
                text: `🎵 *TikTok Downloader*\n\n*Usage:*\n• .tiktok <TikTok link>\n• Reply to TikTok link\n\n_Downloads video without watermark_`
            }, { quoted: message });
            return;
        }

        // Extract URL
        const urlMatch = videoLink.match(/\bhttps?:\/\/\S+/gi);
        if (!urlMatch) {
            await sock.sendMessage(chatId, { text: '❌ Please provide a valid TikTok URL!' }, { quoted: message });
            return;
        }
        videoLink = urlMatch[0];

        // Validate TikTok URL
        const tiktokPattern = /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i;
        if (!tiktokPattern.test(videoLink)) {
            await sock.sendMessage(chatId, { text: '❌ Not a valid TikTok link!' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Try APIs in sequence
        const apis = [
            { name: 'TiklyDown', fn: () => tiktokAPI1(videoLink) },
            { name: 'TiklyDown Link', fn: () => tiktokAPI2(videoLink) },
            { name: 'Tikwm', fn: () => tiktokAPI3(videoLink) },
            { name: 'SnapTik', fn: () => tiktokAPI4(videoLink) }
        ];

        let videoData = null;
        for (const api of apis) {
            try {
                videoData = await api.fn();
                if (videoData?.url) {
                    console.log(`[TIKTOK] Success with ${api.name}`);
                    break;
                }
            } catch (e) {
                console.log(`[TIKTOK] ${api.name} failed:`, e.message);
            }
        }

        if (!videoData?.url) {
            await sock.sendMessage(chatId, {
                text: '❌ Could not download TikTok video.\n\nPossible reasons:\n• Video is private\n• Link is invalid\n• Video was deleted'
            }, { quoted: message });
            cleanTemp();
            return;
        }

        const caption = videoData.author 
            ? `🎵 *${videoData.title}*\n👤 @${videoData.author}\n\n> _Downloaded by ${settings.botName}_`
            : `🎵 *${videoData.title}*\n\n> _Downloaded by ${settings.botName}_`;

        // Send video
        await sock.sendMessage(chatId, {
            video: { url: videoData.url },
            mimetype: 'video/mp4',
            caption
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        cleanTemp();

    } catch (error) {
        console.error('[TIKTOK] Error:', error.message);
        cleanTemp();
        await sock.sendMessage(chatId, {
            text: '❌ Failed to download TikTok video. Please try again.'
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
