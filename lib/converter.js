const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  return new Promise(async (resolve, reject) => {
    try {
      const tempDir = path.join(__dirname, '../temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      let tmp = path.join(tempDir, Date.now() + '.' + ext)
      let out = tmp + '.' + ext2
      await fs.promises.writeFile(tmp, buffer)
      spawn('ffmpeg', [
        '-y',
        '-i', tmp,
        ...args,
        out
      ])
        .on('error', reject)
        .on('close', async (code) => {
          try {
            await fs.promises.unlink(tmp)
            if (code !== 0) return reject(code)
            resolve(await fs.promises.readFile(out))
            await fs.promises.unlink(out)
          } catch (e) {
            reject(e)
          }
        })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Convert Audio to Playable WhatsApp Audio (320kbps)
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension 
 */
function toAudio(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-ac', '2',
    '-b:a', '320k',        // 320kbps for high quality music
    '-ar', '44100',
    '-f', 'mp3'
  ], ext, 'mp3')
}

/**
 * Convert Audio to Playable WhatsApp PTT (High Quality Opus)
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension 
 */
function toPTT(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',        // PTT keeps 128k for voice clarity
    '-vbr', 'on',
    '-compression_level', '10'
  ], ext, 'opus')
}

/**
 * Convert Video to WhatsApp 720p Video
 * @param {Buffer} buffer Video Buffer
 * @param {String} ext File Extension 
 */
function toVideo(buffer, ext) {
  return ffmpeg(buffer, [
    '-c:v', 'libx264',
    '-profile:v', 'baseline',    // WhatsApp compatible
    '-level', '3.1',             // WhatsApp compatible
    '-pix_fmt', 'yuv420p',       // WhatsApp compatible
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease',  // 720p max
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-crf', '23',                // Higher quality (lower = better)
    '-maxrate', '4M',            // WhatsApp limit friendly
    '-bufsize', '8M',
    '-preset', 'medium',         // Faster encoding
    '-movflags', '+faststart',   // Web optimization
    '-fflags', '+genpts'
  ], ext, 'mp4')
}

module.exports = {
  toAudio,   // 320kbps music
  toPTT,     // Voice PTT
  toVideo,   // 720p WhatsApp video
  ffmpeg
}
