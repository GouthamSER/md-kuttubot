const settings  = require('../settings');
const axios     = require('axios');
const yts       = require('yt-search');
const ytdl      = require('ytdl-core');
const { mergeVideoAudio } = require('../lib/converter');
const { cleanTemp }       = require('../lib/cleanTemp');

const AXIOS_CFG = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

const QUALITY_LABELS = ['1080p', '720p', '480p', '360p'];

// ─── Stream a ytdl readable into a Buffer ────────────────────────────────────
function streamToBuffer(readable) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readable.on('data', chunk => chunks.push(chunk));
        readable.on('end',  ()    => resolve(Buffer.concat(chunks)));
        readable.on('error', reject);
    });
}

// ─── Download best quality via ytdl-core, merge with converter.js ────────────
async function downloadViaYtdl(videoUrl) {
    const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        }
    });

    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();

    // ── 1. Try combined stream (has both video+audio in one) ─────────────────
    const combined = ytdl.filterFormats(info.formats, 'videoandaudio');
    for (const label of QUALITY_LABELS) {
        const fmt = combined.find(f => f.qualityLabel === label);
        if (fmt) {
            console.log('[VIDEO] Combined stream found:', label);
            const buf = await streamToBuffer(ytdl.downloadFromInfo(info, { format: fmt }));
            return { buffer: buf, title };
        }
    }

    // ── 2. Separate video + audio → merge via converter.js ───────────────────
    const videoOnly = ytdl.filterFormats(info.formats, 'videoonly').filter(f => f.container === 'mp4');
    const audioOnly = ytdl.filterFormats(info.formats, 'audioonly')
        .filter(f => f.container === 'mp4' || (f.audioCodec && f.audioCodec.includes('mp4a')));

    let videoFmt = null;
    for (const label of QUALITY_LABELS) {
        videoFmt = videoOnly.find(f => f.qualityLabel === label);
        if (videoFmt) break;
    }
    if (!videoFmt) videoFmt = videoOnly[0];

    const audioFmt = audioOnly.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    if (!videoFmt || !audioFmt) throw new Error('ytdl: no suitable formats found');

    console.log('[VIDEO] Merging:', videoFmt.qualityLabel, '+ audio via converter.js');

    // Download both streams in parallel as buffers, then merge
    const [videoBuf, audioBuf] = await Promise.all([
        streamToBuffer(ytdl.downloadFromInfo(info, { format: videoFmt })),
        streamToBuffer(ytdl.downloadFromInfo(info, { format: audioFmt }))
    ]);

    const merged = await mergeVideoAudio(videoBuf, audioBuf);
    return { buffer: merged, title };
}

// ─── External API fallback chain ─────────────────────────────────────────────
async function tryApiFallback(videoUrl) {
    const retry = async (fn) => {
        let err;
        for (let i = 1; i <= 3; i++) {
            try { return await fn(); }
            catch (e) { err = e; await new Promise(r => setTimeout(r, 1000 * i)); }
        }
        throw err;
    };

    try {
        const res = await retry(() => axios.get(
            'https://eliteprotech-apis.zone.id/ytdown?url=' + encodeURIComponent(videoUrl) + '&format=mp4&quality=720',
            AXIOS_CFG
        ));
        if (res?.data?.success && res?.data?.downloadURL)
            return { url: res.data.downloadURL, title: res.data.title };
    } catch (e) { console.log('[VIDEO] EliteProTech failed:', e.message); }

    try {
        const res = await retry(() => axios.get(
            'https://api.yupra.my.id/api/downloader/ytmp4?url=' + encodeURIComponent(videoUrl) + '&quality=720',
            AXIOS_CFG
        ));
        if (res?.data?.success && res?.data?.data?.download_url)
            return { url: res.data.data.download_url, title: res.data.data.title };
    } catch (e) { console.log('[VIDEO] Yupra failed:', e.message); }

    try {
        const res = await retry(() => axios.get(
            'https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=' + encodeURIComponent(videoUrl),
            AXIOS_CFG
        ));
        if (res?.data?.result?.mp4)
            return { url: res.data.result.mp4, title: res.data.result.title };
    } catch (e) { console.log('[VIDEO] Okatsu failed:', e.message); }

    throw new Error('All API fallbacks failed');
}

// ─── Main command ─────────────────────────────────────────────────────────────
async function videoCommand(sock, chatId, message) {
    try {
        const text        = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, {
                text: '🎬 *Usage:* .video <name or YouTube link>\n\n_Quality: 1080p → 720p → 480p → 360p_'
            }, { quoted: message });
            return;
        }

        // ── Resolve URL ───────────────────────────────────────────────────────
        let videoUrl = '', videoTitle = '', videoThumbnail = '';

        if (/^https?:\/\//i.test(searchQuery)) {
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

        if (!ytdl.validateURL(videoUrl)) {
            await sock.sendMessage(chatId, { text: '❌ Not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // ── Thumbnail + status ────────────────────────────────────────────────
        try {
            const ytId = ytdl.getURLVideoID(videoUrl);
            const thumb = videoThumbnail || ('https://i.ytimg.com/vi/' + ytId + '/sddefault.jpg');
            await sock.sendMessage(chatId, {
                image: { url: thumb },
                caption: '*' + (videoTitle || searchQuery) + '*\n\n⬇️ Downloading best quality (up to 1080p)...'
            }, { quoted: message });
        } catch (_) {}

        // ── Stage 1: ytdl-core ────────────────────────────────────────────────
        let sent = false;
        try {
            const { buffer, title } = await downloadViaYtdl(videoUrl);
            const label = title || videoTitle || searchQuery;
            console.log('[VIDEO] Sending', (buffer.length / 1048576).toFixed(1), 'MB');
            await sock.sendMessage(chatId, {
                video: buffer,
                mimetype: 'video/mp4',
                fileName: label + '.mp4',
                caption: '*' + label + '*\n\n> _Downloaded by ' + settings.botName + '_'
            }, { quoted: message });
            sent = true;
        } catch (e) {
            console.log('[VIDEO] ytdl-core failed:', e.message, '— falling back to APIs...');
        }

        // ── Stage 2: API fallback ─────────────────────────────────────────────
        if (!sent) {
            const { url, title } = await tryApiFallback(videoUrl);
            const label = title || videoTitle || searchQuery;
            await sock.sendMessage(chatId, {
                video: { url },
                mimetype: 'video/mp4',
                fileName: label + '.mp4',
                caption: '*' + label + '*\n\n> _Downloaded by ' + settings.botName + '_'
            }, { quoted: message });
        }

    } catch (error) {
        console.error('[VIDEO] Fatal:', error?.message || error);
        let msg = '❌ Failed to download video.';
        if (error.message?.includes('blocked') || error.response?.status === 451)
            msg = '❌ Content unavailable or region-blocked.';
        else if (error.message?.includes('All API'))
            msg = '❌ All sources failed. Try a different video or link.';
        else if (error.message?.includes('private') || error.message?.includes('unavailable'))
            msg = '❌ This video is private or unavailable.';
        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    } finally {
        cleanTemp();
    }
}

module.exports = videoCommand;
