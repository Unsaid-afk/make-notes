# 🤫 Golgappa Stealth Chat

**Golgappa** is a production-ready, anonymous, and end-to-end encrypted (E2EE) real-time chat web application designed specifically to operate undetected within highly restricted enterprise or educational networks.

It features a pixel-perfect **Google Docs camouflage** interface and advanced evasion techniques to bypass firewalls and monitoring tools.

---

## 🎭 Stealth & Camouflage Features

The application is designed to look and behave like a standard Google Docs page at first glance.

- **Google Docs Skin**: Material Design components, Robbins font, and Google's signature color palette.
- **Boring Metadata**: The tab title is "Class Notes - Untitled Document" with the standard Google Docs blue sheet favicon.
- **Hidden Trigger**: 
  - **Option 1**: Click the **Help (❓)** icon in the header **3 times** rapidly.
  - **Option 2**: Press `Ctrl + Shift + K` on your keyboard.
- **🚨 Panic Mode**: Press `Shift + Esc` (or double-tap `Enter` outside the chat) to instantly redirect to `classroom.google.com`.
- **Payload Obfuscation**: All communication is disguised as "document autosave events" using Base64 encoding.

---

## 🔒 Security Architecture (Zero-Knowledge)

Golgappa uses a "Trust No One" model. The server never sees your messages or your keys.

1. **End-to-End Encryption (E2EE)**: Messages are encrypted using **AES-GCM 256-bit** via the Web Crypto API.
2. **PBKDF2 Key Derivation**: Your **Access Key** (Shared Secret) is never sent to the server. It is used locally in your browser to derive the encryption key.
3. **Stateless Server**: The backend is completely ephemeral. No logs, IPs, or messages are ever written to disk. Everything lives in memory or is passed as an obfuscated blob.
4. **GIF Proxy**: All GIF requests are proxied through the server to prevent direct calls to Giphy/external domains that might be flagged by firewalls.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

You need to run two separate processes: the **Node.js/Socket.io server** and the **Next.js frontend**.

1. **Start the Chat Server**:
   ```bash
   node server/index.js
   ```
   *By default, this runs on port 3001.*

2. **Start the Frontend**:
   ```bash
   npm run dev
   ```
   *Access the app at `http://localhost:3000`.*

---

## 💬 How to Use

1. **Open the Page**: Visit the application URL. You will see a "Class Notes" document about cellular respiration.
2. **Reveal the Chat**: Triple-click the `?` icon or use `Ctrl + Shift + K`.
3. **Join a Room**:
   - **Document ID (Room)**: Enter a unique room name (e.g., `biology-group-2`).
   - **Access Key**: Enter a strong shared password. **Ensure everyone in your group uses the EXACT same key.**
   - **Server URL**: Keep as default (`http://localhost:3001`) unless you've deployed the backend elsewhere.
4. **Chat Features**:
   - **Burn-on-Read**: Enable this in the "Tools" (⚙️ Settings) menu. Messages will self-destruct after a set duration (e.g., 60 seconds).
   - **Anti-Peek Masking**: Click **Edit > Mask text** to hide your typing from "shoulder surfers."
   - **User Sidebar**: Click the blue **Share** button (or the chat bubble icon) to see who else is in the document.

---

## ☁️ Deployment

### 1. Frontend (Firebase Hosting)
This project is configured for static export, making it ideal for Firebase Hosting (*.web.app/google.com subdomains).

```bash
npm run build
# The 'out' directory will be generated for deployment.
```

### 2. Backend
Deploy the `server/index.js` file to a platform that supports WebSockets (e.g., Render, Railway, or a VPS). Ensure you update the **Server URL** in the frontend settings to your production backend URL.

---

## 📜 Notice
This tool is built for privacy and to demonstrate technical network evasion. Always adhere to your local policies and use responsibly.

---

*Golgappa — Chat like nobody's watching. Because to them, you're just taking notes.* 🥟✍️
