<div align="center">

<img src="assets/bot_image.jpg" alt="MD-KuttuBot" width="150" style="border-radius: 50%"/>

# 🤖 MD-KuttuBot

**A powerful WhatsApp Bot built on Baileys**

[![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-v7.0.0--rc-blue?style=flat-square)](https://github.com/WhiskeySockets/Baileys)
[![Version](https://img.shields.io/badge/Version-3.0.7-orange?style=flat-square)](https://github.com/GouthamSER/md-kuttubot)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

> Made with ❤️ by **Goutham Josh** • [YouTube](https://youtube.com/@KilladiChandu) • [GitHub](https://github.com/GouthamSER)

</div>

---

## ✨ Features

- 📱 **QR Code login** with auto-refresh every 60 seconds
- 🔑 **Pairing code login** via `--pairing-code` flag
- 💾 **Session persistence** using `SESSION_ID` environment variable (perfect for panel hosting)
- 🌐 **Built-in web server** on port 8000 for remote QR / pair session
- 🔒 **Public / Private mode** switchable at runtime
- 🛡️ **Anti-call**, **ban system**, and **sudo user** support
- 🧹 **Auto temp cleanup** every 3 hours + RAM watchdog (restarts if >400 MB)
- ⚡ Lightweight store (no `makeInMemoryStore` — compatible with all Baileys versions)

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `.help` / `.menu` / `.list` / `.bot` | Show all commands |
| `.ping` | Check bot response time |
| `.alive` | Check if bot is online |
| `.tagall` | Tag all members in a group *(group admin only)* |
| `.instagram` / `.insta` / `.ig` | Download Instagram video/reel |
| `.story` | Download Instagram story |
| `.facebook` / `.fb` | Download Facebook video |
| `.tiktok` / `.tt` | Download TikTok video |
| `.pinterest` / `.pin` | Download / search Pinterest images |
| `.play` / `.song` / `.mp3` / `.ytmp3` | Download YouTube audio (MP3) |
| `.music` | Play audio via Keith API |
| `.video` / `.ytmp4` | Download YouTube video (MP4) |
| `.tomp3` | Convert video to MP3 |
| `.mode public` | Allow everyone to use commands |
| `.mode private` | Restrict commands to owner/sudo only |

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/GouthamSER/md-kuttubot.git
cd md-kuttubot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the bot

Open `settings.js` and fill in your details:

```js
const settings = {
  botName:     "MD-KuttuBot",
  botOwner:    "Your Name",
  ownerNumber: "919876543210",  // Country code + number, no + or spaces
  version:     "3.0.7",
};
```

### 4. Start the bot

```bash
npm start
```

Scan the QR code that appears in the terminal with WhatsApp:
**Settings → Linked Devices → Link a Device**

The QR auto-refreshes every 60 seconds until you scan it.

---

## 🔐 Authentication Methods

### Method 1 — QR Code (default)

Just run `npm start`. A QR code prints in the terminal. Scan it within 60 seconds. If it expires, a new one appears automatically.

### Method 2 — Pairing Code

```bash
node index.js --pairing-code
```

Enter your WhatsApp number when prompted. A 8-character code appears — enter it in **WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number instead**.

---

## ☁️ Hosting on a Panel (KataBump / Pterodactyl)

The `session/` folder is wiped on every restart. Use the `SESSION_ID` environment variable to persist your session.

**Step 1 — Get your session:**
1. Start the bot locally with `npm start`
2. Scan the QR code
3. After connecting, the bot sends a `creds.json` file to your WhatsApp DM

**Step 2 — Encode it:**
```bash
base64 -w 0 session/creds.json
```

**Step 3 — Set on panel:**
Add the output as the `SESSION_ID` environment variable in your panel's startup settings.

On every restart the bot will automatically decode `SESSION_ID` and restore the session.

---

## 🌐 Web Session Server

When the bot starts, a web server launches at `http://localhost:8000`.

| Route | Description |
|-------|-------------|
| `GET /qr` | Get a QR code as an image (JSON response) |
| `GET /pair` | Get a pairing code for your number |

This is useful for remote deployments where you can't see the terminal.

---

## 📁 Project Structure

```
md-kuttubot/
├── index.js          # Entry point — bot startup & connection handling
├── main.js           # Message router & command dispatcher
├── settings.js       # Bot configuration
├── config.js         # Global config loader
├── commands/         # Individual command files
│   ├── alive.js
│   ├── help.js
│   ├── instagram.js
│   ├── tiktok.js
│   ├── song.js
│   └── ...
├── server/           # Web server for QR / pair session
│   ├── index.js
│   ├── qr.js
│   └── pair.js
├── lib/              # Utility functions
├── data/             # Runtime data (owner, banned users, mode)
├── session/          # WhatsApp session files (auto-created)
└── temp/             # Temporary media files (auto-cleaned)
```

---

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `SESSION_ID` | Base64-encoded `creds.json` for session restore on panel hosting |
| `PORT` | Web server port (default: `8000`) |

---

## 🛠️ npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the bot normally |
| `npm run start:optimized` | Start with memory limits (recommended for VPS) |
| `npm run start:clean` | Clean temp files then start |
| `npm run start:fresh` | Delete session and start fresh |

---

## 📦 Requirements

- **Node.js** v18.0.0 or higher
- **npm** v8+
- A WhatsApp account to link

---

## 🙏 Credits

- [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API library
- Pair code implementation inspired by **TechGod143** & **DGXEON**
- Built and maintained by **Goutham Josh**

---

<div align="center">

**⭐ Star this repo if you find it useful!**

[YouTube](https://youtube.com/@KilladiChandu) • [GitHub](https://github.com/GouthamSER) • [WhatsApp Channel](https://whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A)

</div>
