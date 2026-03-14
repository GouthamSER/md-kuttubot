const yts   = require('yt-search');
const axios = require('axios');
const { cleanTemp } = require('../lib/cleanTemp');

async function playCommand(sock, chatId, message) {
    try {
        const text        = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: '🎵 Usage: .play <song name>' }, { quoted: message });
            return;
        }

        const { videos } = await yts(searchQuery);
        if (!videos?.length) {
            await sock.sendMessage(chatId, { text: '❌ No songs found!' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: '_Please wait, download in progress..._' }, { quoted: message });

        const video  = videos[0];
        const urlYt  = video.url;

        const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
        const data     = response.data;

        if (!data?.status || !data?.result?.downloadUrl) {
            await sock.sendMessage(chatId, { text: '❌ Failed to fetch audio. Please try again.' }, { quoted: message });
            cleanTemp();
            return;
        }

        const audioUrl = data.result.downloadUrl;
        const title    = data.result.title || video.title || 'audio';

        // ✅ Send the file
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        }, { quoted: message });

        // 🧹 Clean temp immediately after send
        cleanTemp();

    } catch (error) {
        console.error('Play command error:', error);
        // 🧹 Clean temp even on error
        cleanTemp();
        await sock.sendMessage(chatId, { text: '❌ Download failed. Please try again.' }, { quoted: message });
    }
}

module.exports = playCommand;
