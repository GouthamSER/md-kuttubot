const axios = require('axios');
const { cleanTemp } = require('../lib/cleanTemp');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*'
};

// ── API helpers ────────────────────────────────────────────────────────────────

// API 1: Hanggts
async function fetchHanggts(url) {
    const res = await axios.get(
        `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`,
        { timeout: 20000, headers: HEADERS, validateStatus: s => s >= 200 && s < 500 }
    );
    const d = res.data;
    const vid =
        d?.result?.media?.video_hd ||
        d?.result?.media?.video_sd ||
        d?.result?.url ||
        (typeof d?.result === 'string' && d.result.startsWith('http') ? d.result : null) ||
        d?.data?.url ||
        (Array.isArray(d?.data) ? (d.data.find(i => i.quality === 'HD')?.url || d.data[0]?.url) : null) ||
        d?.url || d?.download || d?.video?.url || (typeof d?.video === 'string' ? d.video : null);
    if (!vid) throw new Error('Hanggts: no video URL');
    return { url: vid, title: d?.result?.info?.title || d?.result?.title || d?.title || 'Facebook Video' };
}

// API 2: SaveFrom (snapsave)
async function fetchSnapsave(url) {
    const res = await axios.get(
        `https://snapsave.app/action.php?lang=en&url=${encodeURIComponent(url)}`,
        { timeout: 20000, headers: { ...HEADERS, 'Referer': 'https://snapsave.app/' }, validateStatus: s => s >= 200 && s < 500 }
    );
    const d = res.data;
    const vid =
        d?.data?.[0]?.url ||
        d?.data?.video_hd ||
        d?.data?.video_sd;
    if (!vid) throw new Error('Snapsave: no video URL');
    return { url: vid, title: d?.title || 'Facebook Video' };
}

// API 3: Getmyfb
async function fetchGetmyfb(url) {
    const res = await axios.get(
        `https://getmyfb.com/api?url=${encodeURIComponent(url)}`,
        { timeout: 20000, headers: HEADERS, validateStatus: s => s >= 200 && s < 500 }
    );
    const d = res.data;
    const vid = d?.hd || d?.sd || d?.download || d?.url;
    if (!vid) throw new Error('Getmyfb: no video URL');
    return { url: vid, title: d?.title || 'Facebook Video' };
}

// ── Main command ───────────────────────────────────────────────────────────────

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url  = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await sock.sendMessage(chatId,
                { text: '📘 Usage: .fb <Facebook video link>\nExample: .fb https://fb.watch/...' },
                { quoted: message }
            );
            return;
        }

        const fbPattern = /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.com)\//i;
        if (!fbPattern.test(url)) {
            await sock.sendMessage(chatId, { text: '❌ Not a valid Facebook link.' }, { quoted: message });
            return;
        }

        // React to show processing
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Resolve short/share URLs (fb.watch, fburl, etc.)
        let resolvedUrl = url;
        try {
            const headRes = await axios.get(url, {
                timeout: 15000, maxRedirects: 10,
                headers: { 'User-Agent': HEADERS['User-Agent'] }
            });
            const final = headRes?.request?.res?.responseUrl || headRes?.request?.responseURL;
            if (final && typeof final === 'string') resolvedUrl = final;
        } catch (_) { /* use original URL */ }

        // Try each API with fallback
        const apis = [
            { name: 'Hanggts',   fn: () => fetchHanggts(resolvedUrl) },
            { name: 'Snapsave',  fn: () => fetchSnapsave(resolvedUrl) },
            { name: 'Getmyfb',   fn: () => fetchGetmyfb(resolvedUrl) },
            // Last resort — retry Hanggts with original URL
            { name: 'Hanggts(original)', fn: () => fetchHanggts(url) }
        ];

        let videoData = null;
        for (const api of apis) {
            try {
                videoData = await api.fn();
                if (videoData?.url) break;
            } catch (e) {
                console.log(`[FB] ${api.name} failed: ${e.message}`);
            }
        }

        if (!videoData?.url) {
            await sock.sendMessage(chatId, {
                text: '❌ Could not download this Facebook video.\n\nPossible reasons:\n• Video is private or deleted\n• Link is invalid\n• Download not available in your region'
            }, { quoted: message });
            cleanTemp();
            return;
        }

        const caption = `📘 *${videoData.title}*\n\n> _Downloaded by Knight Bot_`;

        // ✅ Send the video
        await sock.sendMessage(chatId, {
            video: { url: videoData.url },
            mimetype: 'video/mp4',
            caption
        }, { quoted: message });

        // ✅ React success
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        // 🧹 Clean temp immediately after send
        cleanTemp();

    } catch (error) {
        console.error('[FB] Error:', error.message);
        // 🧹 Clean temp even on error
        cleanTemp();
        await sock.sendMessage(chatId, {
            text: '❌ Failed to download Facebook video. Please try again.'
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
