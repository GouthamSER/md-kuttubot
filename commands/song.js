const axios = require('axios');
const yts   = require('yt-search');
const { toAudio }   = require('../lib/converter');
const { cleanTemp } = require('../lib/cleanTemp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

// Helper function to download media from quoted message
async function downloadQuotedMedia(quotedMsg) {
    try {
        const messageType = Object.keys(quotedMsg)[0];
        const stream = await downloadContentFromMessage(quotedMsg[messageType], messageType.replace('Message', ''));
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        return buffer;
    } catch (error) {
        console.error('[SONG] Media download error:', error);
        throw error;
    }
}

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

        // Check if replying to a video message
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasQuotedVideo = quotedMessage?.videoMessage;

        // Case 1: User replied to a video with .mp3 or .song
        if (hasQuotedVideo) {
            await sock.sendMessage(chatId, { 
                text: '🎵 Converting video to MP3...' 
            }, { quoted: message });

            try {
                // Download the video from the quoted message
                const videoBuffer = await downloadQuotedMedia(quotedMessage);
                
                if (!videoBuffer || videoBuffer.length === 0) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Failed to download video!' 
                    }, { quoted: message });
                    return;
                }

                // Get filename from caption or use default
                const videoMsg = quotedMessage.videoMessage;
                const fileName = videoMsg.caption?.replace(/[^\w\s-]/g, '').substring(0, 50) || 'converted_audio';
                
                // Convert video to MP3
                console.log('[SONG] Converting video to MP3...');
                const mp3Buffer = await toAudio(videoBuffer, 'mp4');
                
                if (!mp3Buffer?.length) {
                    throw new Error('Conversion failed');
                }

                // Send MP3
                await sock.sendMessage(chatId, {
                    audio: mp3Buffer,
                    mimetype: 'audio/mpeg',
                    fileName: fileName + '.mp3',
                    ptt: false
                }, { quoted: message });

                console.log('[SONG] Sent MP3:', (mp3Buffer.length / 1048576).toFixed(1), 'MB');
                cleanTemp();
                return;

            } catch (convertErr) {
                console.error('[SONG] Video conversion error:', convertErr);
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to convert video to MP3!' 
                }, { quoted: message });
                cleanTemp();
                return;
            }
        }

        // Case 2: Normal YouTube download (no video reply)
        if (!searchQuery) {
            await sock.sendMessage(chatId, { 
                text: '🎵 *Usage:*\n\n1️⃣ Reply to a video with .mp3\n2️⃣ .mp3 <song name or YouTube link>' 
            }, { quoted: message });
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
