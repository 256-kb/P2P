# ⚡ P2P — Serverless & Encrypted WebRTC File Sharing

> **100% Client-Side & Serverless.** Transfer files & folders directly between devices with zero backend, zero trackers, and **End-to-End AES-256-GCM Encryption**.

Hosted automatically on **GitHub Pages**.

---

## 🔒 How Security & Serverless Signaling Works

1. **Zero Proprietary Backend** : The app runs 100% in the browser and uses public high-availability TLS MQTT brokers (`HiveMQ` / `EMQX`) solely to exchange initial WebRTC connection handshakes.
2. **End-to-End Encryption (E2EE)** :
   - The room secret is stored in the URL hash (e.g. `https://256-kb.github.io/P2P/#secret-abc123xyz`).
   - The URL hash is **never sent over the network** (RFC standards dictate URL fragments stay strictly local to the browser).
   - Every single signaling packet (discovery, SDP offers, answers, ICE candidates) is encrypted with **AES-256-GCM** using keys derived via PBKDF2 directly on your device.
   - **No eavesdropper or broker can read who is connecting or decrypt the WebRTC metadata.**
3. **Direct DataChannel Transfer** : Once connected, files travel directly from device to device via peer-to-peer WebRTC DTLS/SCTP channels.

---

## ✨ Features

- ⚡ **Pure Static Frontend** : Zero servers to run or pay for. Works seamlessly on GitHub Pages.
- 📁 **Folder Transfer & Auto-Zip** : Drag & drop entire folders or select via picker to compress on the fly with JSZip and send as a `.zip` archive.
- 📑 **Sequential Batch Queue** : Multiple files are sent one by one with memory-safe WebRTC flow control (`bufferedAmountLowThreshold`).
- 🌓 **Minimalist B&W Interface** : Clean design with Dark/Light theme toggle.
- 📱 **Mobile & iOS Safari Optimized** : Background recovery & wake synchronization.

---

## 🚀 Activation on GitHub Pages (1 Click)

1. Go to your repository on GitHub: **[github.com/256-kb/P2P](https://github.com/256-kb/P2P)**.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Branch**, select `main` branch and `/ (root)` folder.
4. Click **Save**.
5. Your app is immediately live at: **`https://256-kb.github.io/P2P/`** !
