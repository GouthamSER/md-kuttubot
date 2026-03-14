const axios = require('axios');
const yts   = require('yt-search');
const { cleanTemp } = require('../lib/cleanTemp');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(fn, attempts = 3) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try { return await fn(); }
        catch (e) { lastErr = e; if (i < attempts) await new Promise(r => setTimeout(r, 1000 * i)); }
    }
    throw lastErr;
}

async function eliteProTech(url) {
    const res = await tryRequest(() => axios.get(
        `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`,
        AXIOS_DEFAULTS
    ));
    if (res?.data?.success && res?.data?.downloadURL)
        return { download: res.data.downloadURL, title: res.data.title };
    throw new Error('EliteProTech: no download URL');
}

async function yupra(url) {
    const res = await tryRequest(() => axios.get(
        `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`,
        AXIOS_DEFAULTS
    ));
    if (res?.data?.success && res?.data?.data?.download_url)
        return { download: res.data.data.download_url, title: res.data.data.title, thumbnail: res.data.data.thumbnail };
    throw new Error('Yupra: no download URL');
}

async function okatsu(url) {
    const res = await tryRequest(() => axios.get(
        `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`,
        AXIOS_DEFAULTS
    ));
    if (res?.data?.result?.mp4)
        return { download: res.data.result.mp4, title: res.data.result.title };
    throw new Error('Okatsu: no mp4 URL');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text        = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: '🎬 Usage: .video <name or YouTube link>' }, { quoted: message });
            return;
        }

        let videoUrl = '', videoTitle = '', videoThumbnail = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos?.length) {
                await sock.sendMessage(chatId, { text: '❌ No videos found!' }, { quoted: message });
                return;
            }
            videoUrl       = videos[0].url;
            videoTitle     = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // Validate YouTube URL
        if (!videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/gi)) {
            await sock.sendMessage(chatId, { text: '❌ Not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Send thumbnail immediately
        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null);
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${videoTitle || searchQuery}*\n🎬 Downloading...`
                }, { quoted: message });
            }
        } catch (_) {}

        // Try APIs in order
        let videoData;
        let downloadSuccess = false;

        const apis = [
            { name: 'EliteProTech', fn: () => eliteProTech(videoUrl) },
            { name: 'Yupra',        fn: () => yupra(videoUrl) },
            { name: 'Okatsu',       fn: () => okatsu(videoUrl) }
        ];

        for (const api of apis) {
            try {
                videoData = await api.fn();
                if (videoData?.download) { downloadSuccess = true; break; }
                console.log(`${api.name}: no URL`);
            } catch (e) {
                console.log(`${api.name} failed:`, e.message);
            }
        }

        if (!downloadSuccess || !videoData?.download)
            throw new Error('All download sources failed.');

        const title = (videoData.title || videoTitle || 'video').replace(/[^\w\s-]/g, '');

        // ✅ Send the file
        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption: `*${title}*\n\n> _Downloaded by Knight Bot MD_`
        }, { quoted: message });

        // 🧹 Clean temp immediately after send
        cleanTemp();

    } catch (error) {
        console.error('[VIDEO] Error:', error?.message || error);
        // 🧹 Clean temp even on error
        cleanTemp();

        let msg = '❌ Failed to download video.';
        if (error.response?.status === 451 || error.message?.includes('blocked'))
            msg = '❌ Download blocked. Content unavailable in your region.';
        else if (error.message?.includes('All download sources'))
            msg = '❌ All sources failed. Please try a different video.';

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    }
}

module.exports = videoCommand;
