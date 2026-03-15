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
 * HD Audio for WhatsApp (320kbps Music)
 */
function toAudio(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-ac', '2',
    '-b:a', '320k',
    '-ar', '48000',     // HD Audio sample rate
    '-f', 'mp3'
  ], ext, 'mp3')
}

/**
 * WhatsApp HD Video (1080p - HD Download Quality)
 * @param {Buffer} buffer Video Buffer
 * @param {String} ext File Extension 
 * @param {Boolean} hd1080 Enable Full HD (default: true)
 */
function toVideo(buffer, ext, hd1080 = true) {
  const scaleFilter = hd1080 
    ? 'scale=1920:1080:force_original_aspect_ratio=decrease'  // Full HD
    : 'scale=1280:720:force_original_aspect_ratio=decrease';  // 720p fallback
  
  return ffmpeg(buffer, [
    // === WHATSAPP HD COMPATIBLE VIDEO SETTINGS ===
    '-c:v', 'libx264',
    '-profile:v', 'high',           // HD profile (WhatsApp HD support)
    '-level:v', '4.0',              // HD level support
    '-pix_fmt', 'yuv420p',          // Mandatory for WhatsApp
    '-vf', scaleFilter,
    
    // === HD AUDIO ===
    '-c:a', 'aac',
    '-b:a', '256k',                 // HD Audio bitrate
    '-ar', '48000',                 // HD Audio sample rate
    
    // === WHATSAPP HD QUALITY ===
    '-crf', '18',                   // Ultra HD quality (lower = better)
    '-maxrate', '8M',               // HD bitrate limit
    '-bufsize', '16M',
    
    // === WHATSAPP OPTIMIZATIONS ===
    '-preset', 'medium',
    '-movflags', '+faststart',
    '-fflags', '+genpts+discardcorrupt',
    '-avoid_negative_ts', 'make_zero',
    
    // === HD METADATA ===
    '-metadata:s:v:0', 'rotate=0'
  ], ext, 'mp4')
}

/**
 * WhatsApp HD Story Format (9:16 Vertical HD)
 */
function toStory(buffer, ext) {
  return ffmpeg(buffer, [
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level:v', '4.0',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
    '-c:a', 'aac',
    '-b:a', '256k',
    '-ar', '48000',
    '-crf', '18',
    '-maxrate', '8M',
    '-bufsize', '16M',
    '-preset', 'medium',
    '-movflags', '+faststart'
  ], ext, 'mp4')
}

module.exports = {
  toAudio,    // 320kbps HD Music
  toVideo,    // HD 1080p Video (WhatsApp HD download)
  toStory,    // HD Vertical Stories
  ffmpeg
}
