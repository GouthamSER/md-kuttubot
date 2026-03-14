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

MD-KuttuBot is a clean, minimal WhatsApp bot powered by the [Baileys](https://github.com/WhiskeySockets/Baileys) library.  
It focuses on **downloader commands** and **group utilities** — no bloat, no unused code.

---

## ✨ Features

| Category | Commands |
|---|---|
| 📡 General | `.ping` `.alive` `.help` `.menu` `.list` |
| 🎵 Audio Download | `.song` `.play` |
| 🎬 Video Download | `.video` |
| 📸 Instagram | `.insta` `.instagram` |
| 📘 Facebook | `.fb` `.facebook` |
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
| `.song <name or URL>` | Download audio as MP3 (multi-API fallback) |
| `.play <name>` | Download audio via Keith API |
| `.video <name or URL>` | Download YouTube video as MP4 |
| `.insta <link>` | Download Instagram post, reel, or video |
| `.fb <link>` | Download Facebook video (HD preferred) |

### 👥 Group
| Command | Description |
|---|---|
| `.tagall` | Mention all group members *(Admin only)* |

### 🔒 Owner
| Command | Description |
|---|---|
| `.mode public` | Allow everyone to use commands |
| `.mode private` | Restrict commands to owner/sudo only |
| `.mode` | Check current mode |

---

## ⚙️ Requirements

- **Node.js** v18 or higher
- **FFmpeg** installed on your system
- A WhatsApp account for pairing

---

## 🚀 Installation

### 1. Clone or extract the project

```bash
git clone https://github.com/GouthamJosh/md-kuttubot.git
cd md-kuttubot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Get your Session ID

> **You must generate a session before starting the bot.**

👉 Open the session scanner: **[https://qrkuttubotmd-0hef.onrender.com/](https://qrkuttubotmd-0hef.onrender.com/)**

1. Enter your WhatsApp number (with country code, no `+`)
2. A **pairing code** will be displayed
3. On your phone: WhatsApp → Settings → Linked Devices → Link a Device → enter the code
4. Your `session/` credentials will be saved automatically

> ⚠️ Keep your session folder safe. Never share it publicly.

### 4. Configure your settings

Open `settings.js` and set your details:

```js
const settings = {
  botName:     "MD-KuttuBot",      // Bot display name
  botOwner:    "Goutham Josh",     // Your name
  ownerNumber: "919876543210",     // Your number (with country code, no + or spaces)
  version:     "3.0.7",
};
```

### 5. Start the bot

```bash
npm start
```

---

## 📁 Project Structure

```
md-kuttubot/
│
├── commands/          # Command handlers
│   ├── alive.js
│   ├── facebook.js
│   ├── help.js
│   ├── instagram.js
│   ├── ping.js
│   ├── play.js
│   ├── song.js
│   ├── tagall.js
│   └── video.js
│
├── lib/               # Core utilities
│   ├── cleanTemp.js   # Auto temp file cleaner
│   ├── converter.js   # FFmpeg audio/video converter
│   ├── isAdmin.js
│   ├── isBanned.js
│   ├── isOwner.js
│   └── ...
│
├── data/              # Persistent JSON data
│   ├── banned.json
│   ├── messageCount.json
│   └── owner.json
│
├── session/           # WhatsApp session credentials (auto-generated)
├── temp/              # Temp files (auto-cleaned after every download)
├── assets/            # Bot images
├── index.js           # Entry point & WhatsApp connection
├── main.js            # Message handler & command router
├── settings.js        # Bot configuration
└── package.json
```

---

## 🔄 How Downloaders Work

Each downloader uses a **multi-API fallback chain** — if the first API fails, it automatically tries the next:

**Audio (`.song` / `.play`)**
```
EliteProTech → Yupra → Okatsu
```

**Video (`.video`)**
```
EliteProTech → Yupra → Okatsu
```

**Facebook (`.fb`)**
```
Hanggts → Snapsave → Getmyfb
```

**Instagram (`.insta`)**
```
ruhend-scraper (handles posts, reels, stories, carousels)
```

### 🧹 Auto Temp Cleanup

Every download command **immediately deletes all temp files** after sending — both on success and on error.  
This keeps your server storage clean with zero leftover files.

---

## 🛡️ Bot Modes

| Mode | Behavior |
|---|---|
| `public` | Anyone can use commands |
| `private` | Only owner/sudo can use commands |

Switch modes with:
```
.mode public
.mode private
```

---

## 🔧 Configuration (`settings.js`)

| Key | Description | Example |
|---|---|---|
| `botName` | Bot display name | `"MD-KuttuBot"` |
| `botOwner` | Owner name | `"Goutham Josh"` |
| `ownerNumber` | Owner phone (no + or spaces) | `"919876543210"` |
| `packname` | Sticker pack name | `"MD-KuttuBot"` |
| `version` | Bot version | `"3.0.7"` |

---

## 🐛 Troubleshooting

**Bot not connecting?**
- Make sure your `session/` folder has valid credentials
- Regenerate session at [https://qrkuttubotmd-0hef.onrender.com/](https://qrkuttubotmd-0hef.onrender.com/)
- Delete the `session/` folder and re-scan if needed

**Downloads failing?**
- Check your internet connection on the server
- Some content may be region-blocked (the bot will notify you)
- Try a different search term or URL

**FFmpeg errors?**
- Install FFmpeg: `sudo apt install ffmpeg` (Linux) or download from [ffmpeg.org](https://ffmpeg.org)
- Verify with: `ffmpeg -version`

**Tagall not working?**
- Make sure the bot is added as a **group admin**

---

## 📜 License

This project is licensed under the **MIT License** — free to use, modify, and distribute.

---

## 🙏 Credits

- **Baileys** — WhatsApp Web API library by [@adiwajshing](https://github.com/adiwajshing)
- **Session Scanner** — [qrkuttubotmd-0hef.onrender.com](https://qrkuttubotmd-0hef.onrender.com/)

---

<div align="center">

**Made with ❤️ by Goutham Josh**

</div>
