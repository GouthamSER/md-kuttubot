const settings = require('../settings');
const { toAudio } = require('../lib/converter');
const { cleanTemp } = require('../lib/cleanTemp');
const axios = require('axios');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const AXIOS_CFG = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

// Helper: Stream to Buffer
function streamToBuffer(readable) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readable.on('data', chunk => chunks.push(chunk));
        readable.on('end', () => resolve(Buffer.concat(chunks)));
        readable.on('error', reject);
    });
}

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
        console.error('[TOMP3] Media download error:', error);
        throw error;
    }
}

// Helper: Download buffer from URL
async function downloadBuffer(url) {
    const response = await axios.get(url, {
        ...AXIOS_CFG,
        responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
}

// Download audio from YouTube
async function downloadYouTubeAudio(videoUrl) {
    const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        }
    });

    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (!audioFormats.length) {
        throw new Error('No audio formats available');
    }

    // Get highest quality audio
    const audioFormat = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    
    console.log('[TOMP3] Downloading audio:', audioFormat.audioBitrate + 'kbps');
    
    const audioBuffer = await streamToBuffer(ytdl.downloadFromInfo(info, { format: audioFormat }));
    return { buffer: audioBuffer, title };
}

// Main command handler
async function tomp3Command(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ').slice(1).join(' ').trim();
        
        // Get quoted/replied message
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasQuotedVideo = quotedMessage?.videoMessage;
        
        let videoBuffer = null;
        let fileName = 'audio';

        // Case 1: User provided a YouTube URL
        if (args && /^https?:\/\//i.test(args)) {
            if (!ytdl.validateURL(args)) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Please provide a valid YouTube link!' 
                }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, { 
                text: '🎵 Downloading and converting to MP3...' 
            }, { quoted: message });

            const { buffer, title } = await downloadYouTubeAudio(args);
            fileName = title;
            
            // Convert to high-quality MP3
            console.log('[TOMP3] Converting to MP3...');
            const mp3Buffer = await toAudio(buffer, 'mp4');
            
            await sock.sendMessage(chatId, {
                audio: mp3Buffer,
                mimetype: 'audio/mpeg',
                fileName: fileName + '.mp3',
                ptt: false
            }, { quoted: message });

            console.log('[TOMP3] Sent MP3:', (mp3Buffer.length / 1048576).toFixed(1), 'MB');
            return;
        }

        // Case 2: User provided a search query (search YouTube)
        if (args && !/^https?:\/\//i.test(args)) {
            await sock.sendMessage(chatId, { 
                text: '🔍 Searching YouTube...' 
            }, { quoted: message });

            const { videos } = await yts(args);
            if (!videos?.length) {
                await sock.sendMessage(chatId, { 
                    text: '❌ No results found for: ' + args 
                }, { quoted: message });
                return;
            }

            const video = videos[0];
            await sock.sendMessage(chatId, { 
                text: `🎵 Found: *${video.title}*\n\n⬇️ Converting to MP3...` 
            }, { quoted: message });

            const { buffer, title } = await downloadYouTubeAudio(video.url);
            fileName = title;
            
            // Convert to high-quality MP3
            console.log('[TOMP3] Converting to MP3...');
            const mp3Buffer = await toAudio(buffer, 'mp4');
            
            await sock.sendMessage(chatId, {
                audio: mp3Buffer,
                mimetype: 'audio/mpeg',
                fileName: fileName + '.mp3',
                ptt: false,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: settings.botName,
                        thumbnailUrl: video.thumbnail,
                        sourceUrl: video.url,
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: message });

            console.log('[TOMP3] Sent MP3:', (mp3Buffer.length / 1048576).toFixed(1), 'MB');
            return;
        }

        // Case 3: User replied to a video message
        if (hasQuotedVideo) {
            await sock.sendMessage(chatId, { 
                text: '🎵 Converting video to MP3...' 
            }, { quoted: message });

            // Download the video
            const videoMsg = quotedMessage.videoMessage;
            videoBuffer = await downloadQuotedMedia(quotedMessage);
            
            if (!videoBuffer || videoBuffer.length === 0) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to download video!' 
                }, { quoted: message });
                return;
            }

            // Get filename from caption or use default
            fileName = videoMsg.caption?.substring(0, 50) || 'converted_audio';
            
            // Convert to MP3
            console.log('[TOMP3] Converting video to MP3...');
            const mp3Buffer = await toAudio(videoBuffer, 'mp4');
            
            await sock.sendMessage(chatId, {
                audio: mp3Buffer,
                mimetype: 'audio/mpeg',
                fileName: fileName + '.mp3',
                ptt: false
            }, { quoted: message });

            console.log('[TOMP3] Sent MP3:', (mp3Buffer.length / 1048576).toFixed(1), 'MB');
            return;
        }

        // Case 4: No input provided - show usage
        await sock.sendMessage(chatId, {
            text: `🎵 *Video to MP3 Converter*

*Usage:*
1️⃣ Reply to a video with .tomp3
2️⃣ .tomp3 <YouTube link>
3️⃣ .tomp3 <search query>

*Examples:*
• .tomp3 https://youtu.be/xxxxx
• .tomp3 Despacito
• Reply to video + .tomp3

_Converts videos to high-quality 320kbps MP3_`
        }, { quoted: message });

    } catch (error) {
        console.error('[TOMP3] Error:', error?.message || error);
        
        let errorMsg = '❌ Failed to convert to MP3.';
        
        if (error.message?.includes('No audio formats')) {
            errorMsg = '❌ No audio available for this video.';
        } else if (error.message?.includes('private') || error.message?.includes('unavailable')) {
            errorMsg = '❌ Video is private or unavailable.';
        } else if (error.message?.includes('blocked')) {
            errorMsg = '❌ Video is region-blocked or restricted.';
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
    } finally {
        cleanTemp();
    }
}

module.exports = tomp3Command;
