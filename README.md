<div align="center">

# 🤖 MD-KuttuBot

**A fast, lightweight WhatsApp bot built on Baileys**

![Version](https://img.shields.io/badge/Version-3.0.7-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-WhatsApp-brightgreen?style=for-the-badge&logo=whatsapp)

</div>

---

## 📌 About

MD-KuttuBot is a clean, minimal WhatsApp bot powered by [Baileys](https://github.com/WhiskeySockets/Baileys).  
It focuses on **high-quality downloaders** and **group utilities** — no bloat, no unused code.

---

## ✨ Features

| Category | Commands |
|---|---|
| 📡 General | `.ping` `.alive` `.help` `.menu` `.list` |
| 🎵 Audio | `.song` `.play` |
| 🎬 Video | `.video` |
| 📸 Instagram | `.insta` |
| 📘 Facebook | `.fb` |
| 👥 Group | `.tagall` |
| 🔒 Owner | `.mode` |

---

## 📋 Commands

### 📡 General

| Command | Description |
|---|---|
| `.ping` | Check bot response speed and uptime |
| `.alive` | Confirm the bot is online |
| `.help` / `.menu` / `.list` | Show all available commands |

### 📥 Downloaders

| Command | Description |
|---|---|
| `.song <name or URL>` | Download audio as MP3 |
| `.play <name>` | Download audio via alternate source |
| `.video <name or URL>` | Download YouTube video — up to **1080p** |
| `.insta <link>` | Download Instagram post, reel, or carousel |
| `.fb <link>` | Download Facebook video (HD preferred) |

### 👥 Group

| Command | Description |
|---|---|
| `.tagall` | Mention all group members *(Admin only)* |

### 🔒 Owner

| Command | Description |
|---|---|
| `.mode public` | Allow everyone to use commands |
| `.mode private` | Restrict to owner/sudo only |
| `.mode` | Check current mode |

---

## 🎬 Video Quality

The `.video` command uses a **two-stage quality chain**:

**Stage 1 — ytdl-core (direct YouTube, highest quality)**
```
1080p → 720p → 480p → 360p
```
- For 720p and above, video and audio streams are downloaded separately then merged using **FFmpeg**
- Gives the best possible quality with no third-party dependency

**Stage 2 — API fallback (if ytdl-core fails)**
```
EliteProTech → Yupra → Okatsu
```
- Automatically retries each API up to 3 times before moving on

---

## ⚙️ Requirements

- **Node.js** v18 or higher
- **FFmpeg** installed on your system
- A WhatsApp account for pairing

---

## 🚀 Installation

### 1. Clone or extract the project / in ubuntu install node 20v 

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

git clone https://github.com/GouthamSER/md-kuttubot.git
cd md-kuttubot
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps --ignore-scripts
```

### 3. Install FFmpeg

**Ubuntu / Debian / Termux:**
```bash
sudo apt install ffmpeg
# or on Termux:
pkg install ffmpeg
```

**Verify:**
```bash
ffmpeg -version
```

### 4. Get your Session ID

> **You must generate a session before starting the bot.**

👉 Open the session scanner: **[https://qrkuttubotmd-0hef.onrender.com/](https://qrkuttubotmd-0hef.onrender.com/)**

1. Enter your WhatsApp number (with country code, `+`)
2. A **pairing code** will be displayed
3. On your phone: WhatsApp → Settings → Linked Devices → Link a Device → enter the code
4. Your `session/` credentials will be saved automatically

> ⚠️ Keep your session folder safe. Never share it publicly.

### 5. Configure settings

Open `settings.js` and fill in your details:

```js
const settings = {
  botName:     "MD-KuttuBot",
  botOwner:    "Your Name",
  ownerNumber: "919876543210",   // country code + number, no + or spaces
};
```

### 6. Start the bot

```bash
npm start
```

---

## 📁 Project Structure

```
md-kuttubot/
│
├── commands/
│   ├── alive.js          # .alive
│   ├── facebook.js       # .fb
│   ├── help.js           # .help / .menu / .list
│   ├── instagram.js      # .insta (posts, reels, carousels)
│   ├── ping.js           # .ping
│   ├── play.js           # .play
│   ├── song.js           # .song
│   ├── tagall.js         # .tagall
│   └── video.js          # .video (up to 1080p)
│
├── lib/
│   ├── cleanTemp.js      # Auto temp file cleanup
│   ├── converter.js      # FFmpeg audio/video helpers
│   ├── isAdmin.js
│   ├── isBanned.js
│   └── isOwner.js
│
├── data/
│   ├── banned.json
│   ├── messageCount.json
│   └── owner.json
│
├── session/              # WhatsApp credentials (auto-generated)
├── temp/                 # Temp files (auto-deleted after every download)
├── assets/               # Bot images
├── index.js              # Entry point & WhatsApp connection
├── main.js               # Message handler & command router
├── settings.js           # Bot configuration
└── package.json
```

---

## 🔄 How Downloaders Work

**Audio (`.song` / `.play`)**
```
EliteProTech → Yupra → Okatsu
```

**Video (`.video`) — with quality**
```
ytdl-core (1080p/720p/480p, ffmpeg merge) → EliteProTech → Yupra → Okatsu
```

**Facebook (`.fb`)**
```
Hanggts → Snapsave → Getmyfb
```

**Instagram (`.insta`)**
```
ruhend-scraper (posts, reels, carousels)
```

### 🧹 Auto Temp Cleanup

Every download **immediately deletes all temp files** after sending, on both success and failure.  
This keeps server storage clean with zero leftover files.

---

## 🛡️ Bot Modes

| Mode | Behavior |
|---|---|
| `public` | Anyone can use commands |
| `private` | Only owner/sudo can use commands |

Switch with:
```
.mode public
.mode private
```

---

## 🔧 Configuration Reference (`settings.js`)

| Key | Description | Example |
|---|---|---|
| `botName` | Display name | `"MD-KuttuBot"` |
| `botOwner` | Owner name | `"Goutham Josh"` |
| `ownerNumber` | Phone number (no + or spaces) | `"919876543210"` |
| `packname` | Sticker pack name | `"MD-KuttuBot"` |
| `version` | Bot version | `"3.0.7"` |

---

## 🐛 Troubleshooting

**Bot not connecting?**
- Make sure `session/` has valid credentials
- Regenerate at [https://qrkuttubotmd-0hef.onrender.com/](https://qrkuttubotmd-0hef.onrender.com/)
- Delete `session/` folder and re-pair if needed

**`.video` downloading low quality?**
- Make sure **FFmpeg is installed** — it's required for 720p/1080p merging
- Verify: `ffmpeg -version`
- If FFmpeg is missing, the bot falls back to API sources which may give lower quality

**Downloads failing?**
- Check internet connection on the server
- Some content may be region-blocked (bot will notify you)
- YouTube frequently updates — if ytdl-core fails, API fallback will kick in automatically

**FFmpeg errors?**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Termux
pkg install ffmpeg
```

**Tagall not working?**
- The bot must be a **group admin**

---

## 📜 License

This project is licensed under the **MIT License** — free to use, modify, and distribute.

---

## 🙏 Credits

- **Baileys** — WhatsApp Web API by [@WhiskeySockets](https://github.com/WhiskeySockets/Baileys)
- **ytdl-core** — YouTube stream downloader
- **Session Scanner** — [qrkuttubotmd-0hef.onrender.com](https://qrkuttubotmd-0hef.onrender.com/)

---

<div align="center">

**Made with ❤️ by Goutham Josh**

</div>
