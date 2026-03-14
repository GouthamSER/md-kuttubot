/**
 * cleanTemp.js
 * Wipes all files in /temp immediately after a download+send completes.
 * Called at the end of every download command.
 */
const fs   = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../temp');

/**
 * Delete all files in the temp folder right now.
 * Runs async fire-and-forget — errors are silently swallowed.
 */
function cleanTemp() {
    try {
        if (!fs.existsSync(TEMP_DIR)) return;
        const files = fs.readdirSync(TEMP_DIR);
        for (const file of files) {
            try {
                const filePath = path.join(TEMP_DIR, file);
                // Only delete files, never sub-directories
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            } catch (_) { /* skip locked / already-deleted files */ }
        }
    } catch (_) { /* folder unreadable — ignore */ }
}

module.exports = { cleanTemp };
