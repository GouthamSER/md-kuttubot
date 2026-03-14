const axios = require('axios');
const yts   = require('yt-search');
const { toAudio }   = require('../lib/converter');
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
        `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
        AXIOS_DEFAULTS
    ));
    if (res?.data?.success && res?.data?.downloadURL)
        return { download: res.data.downloadURL, title: res.data.title };
    throw new Error('EliteProTech: no download URL');
}

async function yupra(url) {
    const res = await tryRequest(() => axios.get(
        `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
        AXIOS_DEFAULTS
    ));
    if (res?.data?.success && res?.data?.data?.download_url)
        return { download: res.data.data.download_url, title: res.data.data.title };
    throw new Error('Yupra: no download URL');
}

async function okatsu(url) {
    const res = await tryRequest(() => axios.get(
        `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
        AXIOS_DEFAULTS
    ));
    if (res?.data?.dl)
        return { download: res.data.dl, title: res.data.title };
    throw new Error('Okatsu: no download URL');
}

async function downloadBuffer(audioUrl) {
    // Try arraybuffer first
    try {
        const res = await axios.get(audioUrl, {
            responseType: 'arraybuffer', timeout: 90000,
            maxContentLength: Infinity, maxBodyLength: Infinity,
            decompress: true, validateStatus: s => s >= 200 && s < 400,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Encoding': 'identity' }
        });
        const buf = Buffer.from(res.data);
        if (buf?.length > 0) return buf;
    } catch (e) {
        if (e.response?.status === 451) throw Object.assign(e, { blocked: true });
    }
    // Fallback: stream
    const res = await axios.get(audioUrl, {
        responseType: 'stream', timeout: 90000,
        maxContentLength: Infinity, maxBodyLength: Infinity,
        validateStatus: s => s >= 200 && s < 400,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Encoding': 'identity' }
    });
    const chunks = [];
    await new Promise((resolve, reject) => {
        res.data.on('data', c => chunks.push(c));
        res.data.on('end', resolve);
        res.data.on('error', reject);
    });
    return Buffer.concat(chunks);
}

async function songCommand(sock, chatId, message) {
    try {
        const rawText    = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = rawText.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: '🎵 Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
            video = { url: searchQuery, title: searchQuery, thumbnail: null, timestamp: 'N/A' };
        } else {
            const search = await yts(searchQuery);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, { text: `❌ No results found for: ${searchQuery}` }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        // Send thumbnail + info
        try {
            if (video.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: video.thumbnail },
                    caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp || 'N/A'}\n\n_Please wait..._`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: `🎵 Downloading: *${video.title}*\n_Please wait..._` }, { quoted: message });
            }
        } catch (_) {}

        // Try APIs in order
        let audioData, audioBuffer;
        let downloadSuccess = false;

        const apis = [
            { name: 'EliteProTech', fn: () => eliteProTech(video.url) },
            { name: 'Yupra',        fn: () => yupra(video.url) },
            { name: 'Okatsu',       fn: () => okatsu(video.url) }
        ];

        for (const api of apis) {
            try {
                audioData = await api.fn();
                const audioUrl = audioData.download;
                if (!audioUrl) { console.log(`${api.name}: no URL`); continue; }

                try {
                    audioBuffer = await downloadBuffer(audioUrl);
                    if (audioBuffer?.length > 0) { downloadSuccess = true; break; }
                } catch (dlErr) {
                    if (dlErr.blocked) { console.log(`${api.name}: 451 blocked`); continue; }
                    console.log(`${api.name} download failed:`, dlErr.message);
                    continue;
                }
            } catch (apiErr) {
                console.log(`${api.name} API failed:`, apiErr.message);
                continue;
            }
        }

        if (!downloadSuccess || !audioBuffer) throw new Error('All download sources failed.');

        // Detect format from file signature
        let ext = 'mp3';
        if (audioBuffer.slice(4, 8).toString('ascii') === 'ftyp') ext = 'm4a';
        else if (audioBuffer.slice(0, 4).toString('ascii') === 'OggS') ext = 'ogg';
        else if (audioBuffer.slice(0, 4).toString('ascii') === 'RIFF') ext = 'wav';

        // Convert non-MP3 to MP3
        let finalBuffer = audioBuffer;
        if (ext !== 'mp3') {
            finalBuffer = await toAudio(audioBuffer, ext);
            if (!finalBuffer?.length) throw new Error('Conversion to MP3 failed');
        }

        const title = (audioData?.title || video.title || 'song').replace(/[^\w\s-]/g, '');

        // ✅ Send the file
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false
        }, { quoted: message });

        // 🧹 Clean temp immediately after send
        cleanTemp();

    } catch (err) {
        console.error('Song command error:', err);
        // 🧹 Clean temp even on error
        cleanTemp();

        let msg = '❌ Failed to download song.';
        if (err.response?.status === 451 || err.message?.includes('blocked'))
            msg = '❌ Download blocked in your region.';
        else if (err.message?.includes('All download sources'))
            msg = '❌ All sources failed. Please try a different song.';

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    }
}

module.exports = songCommand;
