# P2P - High-Performance WebRTC Data & File Transfer Platform

P2P is a decentralized, client-side data transmission platform designed for direct, end-to-end encrypted peer-to-peer file sharing and real-time messaging. Built on standard WebRTC DataChannels and modern browser APIs, the application operates entirely without persistent server infrastructure, intermediate file storage, or telemetry.

Live Deployment: https://256-kb.github.io/p2p/

---

## Executive Overview

Traditional file transfer tools rely on central cloud intermediaries that store, inspect, or log user data. P2P eliminates the central intermediary by establishing direct point-to-point cryptographic tunnels between web browsers across local networks, wide area networks, and cellular infrastructures.

### Key Capabilities

- Zero-Knowledge Architecture: No files, metadata, or messages touch a persistent backend.
- End-to-End Encrypted Transport: WebRTC DTLS 1.3 / SRTP encryption on all data streams.
- Client-Side Archive Generation: Automated streaming directory compression using in-memory ZIP encoding.
- Deterministic Mesh Network: Self-organizing mesh routing with collision avoidance and anchor failover.
- Cellular and Restricted Network Traversal: Integrated dual-stack STUN and TLS/TCP TURN relay fallbacks.
- Integrated Real-Time Communication: Low-latency in-room text channel synchronized over active data pipelines.

---

## Architecture and Technical Design

### 1. Signaling and Discovery Layer

Peer coordination utilizes an isolated, client-partitioned signaling mechanism.

- Cryptographic Room Isolation: The room secret is anchored in the URI fragment (`window.location.hash`). Per RFC 3986, fragment identifiers are strictly local to the user agent and are never transmitted to HTTP servers.
- Dynamic Mesh Leader Election: The initial peer claiming the room namespace acts as an anchor node (`p2p_[hash]_0`). Subsequent peers register and receive an immediate peer directory before forming direct mesh interconnects.
- Deterministic Handshake Policy: Handshake collisions are resolved through lexicographical ID comparison (`selfPeerId < targetPeerId`), preventing duplicate channel allocation and race conditions.

### 2. Transport and DataChannel Streaming

Data exchange leverages standardized `RTCDataChannel` pipelines configured with ordered delivery and SCTP flow control:

- Chunk Fragmentation: Large binary payloads are segmented into memory-efficient 64 KB chunks.
- Backpressure Management: Dynamic flow control monitoring via `bufferedAmountLowThreshold` (256 KB) prevents buffer bloat and browser memory saturation during gigabit-speed transfers.
- Binary Format Normalization: Native handling across `ArrayBuffer`, `Uint8Array`, and `Blob` formats ensures consistent transfer performance across iOS WebKit, Chromium, and Gecko engines.

### 3. NAT Traversal and Resilience

The platform implements an adaptive ICE gathering engine:

- STUN Protocol: Standard reflexive candidate discovery for open and full-cone NAT topologies.
- TURN Relays (UDP/TCP/TLS): Fallback relays on standard ports (80 and 443) to guarantee 100% connectivity across symmetric NATs, enterprise firewalls, and carrier-grade NAT (CGNAT) on cellular networks (4G/5G).
- Automated ICE Recovery: Detection of transient network interruptions triggers non-destructive candidate renegotiation.

---

## Product Features

### Batch and Directory Transfers

- Multi-File Queue: Sequential file ingestion pipeline with automatic authorization retention for multi-file transfers.
- Directory Structure Preservation: Automatic recursive traversal of hierarchical folder structures with on-the-fly client-side archive packaging via JSZip.

### Real-Time In-Room Messaging

- Ephemeral Communication: Text messages are broadcast directly across open DataChannels with zero persistence.
- System Telemetry: Live feedback for peer connections, disconnects, and transfer state changes.

### Minimalist User Interface

- Responsive Layout: Dynamic orbital radar visualization adapting to desktop, tablet, and mobile form factors.
- Theme System: High-contrast Dark and Light color palettes compliant with WCAG accessibility standards.
- Progress Telemetry: Real-time throughput metrics (KB/s, MB/s), transferred percentage, and dynamic time-to-completion estimation.

---

## Security Model

| Security Dimension | Implementation |
| :--- | :--- |
| Transport Security | WebRTC DTLS 1.3 encryption for all DataChannels |
| Data Confidentiality | Direct browser-to-browser streaming; zero server-side storage |
| Identity & Room Privacy | Client-side URI fragment hashing via SHA-256 |
| Code Integrity | Pure static delivery over HTTPS via GitHub Pages |
| External Dependencies | Standalone CDN-pinned libraries with strict subresource verification |

---

## Browser Support Matrix

| Platform / Engine | Version | Status |
| :--- | :--- | :--- |
| Google Chrome / Chromium | 88+ | Fully Supported |
| Apple Safari (macOS & iOS) | 14.1+ | Fully Supported |
| Mozilla Firefox | 85+ | Fully Supported |
| Microsoft Edge | 88+ | Fully Supported |
| Android WebViews / Mobile Browsers | Modern | Fully Supported |

---

## Deployment and Operation

The application is completely static and requires zero backend provisioning.

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/256-kb/P2P.git
   cd P2P
   ```

2. Serve locally with any static web server:
   ```bash
   npx serve .
   ```

3. Open `http://localhost:3000` in multiple browser windows to test local mesh discovery.

### Production Hosting

The project is pre-configured for instant deployment on GitHub Pages or any static CDN (Cloudflare Pages, Vercel, Netlify, AWS S3).
