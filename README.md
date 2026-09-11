# SwiftFinance

> **Live Application**: [https://monofinance.duckdns.org](https://monofinance.duckdns.org)
>
> Privacy-first personal finance tracking platform with AI-powered expense categorization, voice dictation, target savings envelopes, PWA and native Android client.

[![Live](https://img.shields.io/badge/Live-monofinance.duckdns.org-FF5A36?style=flat-square&logo=googlechrome&logoColor=white)](https://monofinance.duckdns.org)
[![PWA](https://img.shields.io/badge/PWA-iOS_%2F_Android-161B22?style=flat-square&logo=pwa&logoColor=white)](https://monofinance.duckdns.org)
[![Python](https://img.shields.io/badge/Python-3.10+-161B22?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Groq AI](https://img.shields.io/badge/Groq_AI-LLaMA_3.3_%2F_Whisper-161B22?style=flat-square&logo=openai&logoColor=white)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-161B22?style=flat-square)](LICENSE)

---

## Application Preview

![SwiftFinance Dashboard Preview](dashboard_preview.png)

*SwiftFinance Dark Theme Dashboard featuring live financial health metrics, calendar-scale cashflow trend charts, multi-period spending limits carousel, and target savings envelopes.*

---

## Live Access

- **Official Web Application / PWA**: [https://monofinance.duckdns.org](https://monofinance.duckdns.org) (HTTPS / Let's Encrypt SSL)

---

SwiftFinance is a modern, privacy-first personal finance tracking platform engineered for high performance, intuitive data visualization, and seamless cross-device synchronization. Built with a dark charcoal aesthetic and vibrant orange-red accents (`#20a034`) inspired by the Metric Flow design language, SwiftFinance combines comprehensive cashflow monitoring, target-based savings envelopes, dynamic budget limits, and AI-driven expense categorization with voice dictation support across web, iOS PWA, and native Android clients.

---

## Table of Contents

- [Application Preview](#application-preview)
- [Live Access](#live-access)
- [Overview](#overview)
- [Design Philosophy](#design-philosophy)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Installation and Local Setup](#installation-and-local-setup)
- [Production Deployment](#production-deployment)
- [Android Application](#android-application)
- [Chronological Project History](#chronological-project-history)
- [Security and Data Privacy](#security-and-data-privacy)
- [License and Author](#license-and-author)

---

## Overview

Managing personal finances often suffers from cluttered interfaces, rigid third-party banking integrations, and lack of customization. SwiftFinance solves this by delivering an ultra-fast, single-page application (SPA) backed by a lightweight Python/Flask REST service and SQLite database. Users can operate SwiftFinance in full cloud-sync mode with password-protected sessions, or run it completely client-side in Demo/Local mode via browser `localStorage`.

---

## Design Philosophy

- **Metric Flow Aesthetic**: High-contrast, dark charcoal background (`#121212` / `#0A0A0A`) with an energetic orange-red brand accent (`#20a034`), purple utility accents (`#20a034`), and clear typography.
- **Zero Distractions**: Essential data is prioritized. Unnecessary headers, promotional banners, and complex nested menus are eliminated in favor of clean cards, sliding pills, and responsive widgets.
- **Adaptive Ergonomics**: Tailored layouts for both large desktop monitors and mobile touchscreens (smartphones such as iPhone 13 and POCO X6), featuring gesture-friendly controls, bottom sheets, and swipeable carousels.
- **Strictly No Emojis**: Minimalist, professional iconography using clean vector SVG glyphs and Google Material Symbols.

---

## Key Features

### 1. Financial Dashboard and Analytics
- **Live Metric Cards**: Instant summary of Total Balance, Monthly Incomes, Monthly Expenses, Net Cashflow, and Savings Cushion.
- **Calendar-Scale SVG Trend Charts**: Responsive, vector-based line charts tracking daily cumulative income and expense trends across the exact days of the selected calendar month without coordinate distortion.
- **Month-by-Month (MoM) Navigation**: Interactive month selector (`< Month Year >`) with modal year/month picker that dynamically updates all metrics, breakdown charts, top expenses, income sources, and transaction registries.
- **Financial Health Analysis**: Real-time evaluation of savings rate, budget status, and safety cushion capacity.

### 2. Transaction Management and Auto-Debits
- **Multi-Type Ledger**: Unified registry supporting Incomes, Expenses, and Savings transfers with instant search, date filtering, and category badges.
- **Sliding Pill Type Switcher**: Touch-friendly, animated category filter (All, Income, Expense, Savings) with smooth sliding pill indicator.
- **Automated Recurring Debits (Auto-Debits)**: Background scheduler for daily recurring expenses (e.g., commute, subscriptions) featuring a catch-up algorithm that accounts for offline days.

### 3. Target Savings Envelopes
- **Dedicated Goal Envelopes**: Visual cards for individual savings targets (e.g., Emergency Fund, Tech, Travel) with custom target amounts, color tags, and icon badges.
- **Isolated Balance Architecture**: Envelope deposits and withdrawals are isolated from the main income/expense cashflow to preserve true financial metrics.
- **Real-Time Progress**: Dynamic percentage bars and remaining amount indicators.
- **Envelopes History**: Persistent log of all envelope allocations and withdrawals.

### 4. Spending Limits and Budget Control
- **Multi-Period Limit Carousel**: Flexible spending limits configurable across Day, Week, or Month horizons.
- **Efficiency Analytics**: Visual progress gauge indicating safe spending pacing, remaining daily allowance, and threshold warnings.
- **Responsive Controls**: Quick period toggling on desktop and swipeable bottom sheets on mobile devices.

### 5. Artificial Intelligence Categorization
- **Groq LLM Integration**: Automated semantic categorization of raw expense descriptions into 8 standardized categories using `llama-3.3-70b-versatile` with low-latency fallback logic.
- **Category Deep Dive Modal**: Interactive breakdown modal showing all historical transactions, percentage share, and total spent for any chosen category.

### 6. Voice Input and Ukrainian Natural Language Processing
- **iOS Standalone PWA Voice Input**: Voice dictation fallback using HTML5 `MediaRecorder` streaming audio directly to Groq Whisper AI (`whisper-large-v3-turbo`) for Ukrainian speech-to-text.
- **Native Android Speech Engine**: Android Kotlin app utilizing system `SpeechRecognizer` with custom multi-item syntax parsing (e.g., splitting multiple purchases separated by conjunctions like "and", "plus", commas).

### 7. Dual Theme Support
- **Dark and Light Themes**: Seamless switching between deep OLED black/charcoal and crisp high-contrast light mode with dedicated color tokens for all cards, charts, and input fields.

---

## System Architecture

```
[ Native Android Client (Kotlin) ]
               |
               v (REST API / Cookie Session)
[ Cloud Infrastructure (Oracle Cloud VPS / HTTPS) ]
  |--> Nginx Reverse Proxy (SSL / Let's Encrypt / DuckDNS)
         |--> Gunicorn WSGI Server
                |--> Flask Application (app_server.py)
                       |--> SQLite Database (monofinance.db)
                       |--> Groq AI API (llama-3.3 / whisper-large-v3)
  |--> Static Web Client / PWA (index.html, app.js, styles.css, sw.js)
```

- **Client Layer**: SPA built with standard browser APIs, Service Worker offline cache, and Tailwind CSS.
- **API Layer**: Python Flask backend exposing REST endpoints for authentication, state synchronization, and audio processing.
- **Data Layer**: SQLite3 database with parameterized SQL queries, secure password hashing (`scrypt`), and isolated user tables.
- **External Services**: Groq Cloud API for LLM inference and Whisper speech transcription.

---

## Technology Stack

### Frontend
- **Languages**: HTML5, CSS3, JavaScript (ES6+ Vanilla)
- **Styling**: Tailwind CSS (Utility classes & Grid), Vanilla CSS (Custom properties, animations, scrollbars)
- **Progressive Web App**: Service Worker (`sw.js`), Web App Manifest (`manifest.json`), Offline Cache Storage
- **Typography & Icons**: Inter Font, Google Material Symbols

### Backend & API
- **Runtime**: Python 3.10+
- **Framework**: Flask, Gunicorn
- **Database**: SQLite3 (`monofinance.db`)
- **Authentication**: Session cookies, `werkzeug.security` (`generate_password_hash`, `check_password_hash`)

### Artificial Intelligence & Speech
- **Semantic Classification**: Groq API (`llama-3.3-70b-versatile`)
- **Speech-to-Text**: Groq Whisper API (`whisper-large-v3-turbo`), Android `SpeechRecognizer`

### Mobile (Android)
- **Language**: Kotlin
- **Build System**: Gradle Kotlin DSL (`build.gradle.kts`)
- **Networking**: OkHttp3 with persistent `CookieJar`
- **UI Components**: AndroidX, Material Components, Adaptive Vector Drawables

### Infrastructure & Operations
- **Hosting**: Oracle Cloud Infrastructure (Ubuntu VPS)
- **Web Server**: Nginx (Reverse Proxy & HTTP/2 termination)
- **Domain & SSL**: DuckDNS Dynamic DNS, Let's Encrypt Certbot SSL
- **Tunnels & Remote Access**: Cloudflare Tunnel, LocalTunnel, Ngrok support scripts

---

## Repository Structure

```
SwiftFinance/
|-- app.js                           # Core frontend application logic, state, UI rendering
|-- app_server.py                    # Flask REST API server, authentication, SQLite handlers
|-- index.html                       # Main single-page application structure and modals
|-- styles.css                       # Custom CSS properties, theme variables, animations
|-- sw.js                            # PWA Service Worker for offline caching and assets
|-- manifest.json                    # PWA installation manifest for iOS and Android
|-- monofinance.db                   # SQLite database file (runtime)
|-- deploy.sh                        # Bash automated deployment script for Oracle Cloud VPS
|-- enable_monofinance_ssl.sh        # SSL configuration and renewal helper script
|-- fix_monofinance_duckdns_http.sh  # HTTP fallback and port proxy script
|-- restore_nginx.sh                 # Nginx configuration restoration utility
|-- setup_https.sh                   # Automated HTTPS provisioning script
|-- setup_localtunnel.sh             # LocalTunnel developer tunnel script
|-- setup_monofinance_duckdns.sh     # DuckDNS dynamic DNS updater configuration
|-- setup_ngrok.sh                   # Ngrok secure tunnel setup script
|-- setup_ssl_domain.sh              # Custom domain SSL certificate setup
|-- start_cloudflare_tunnel.sh       # Cloudflare Tunnel execution script
|-- update_server.py                 # Remote migration and database update script
|-- favicon.svg                      # Vector branding icon
|-- MonoFinanceAndroid/              # Native Android application source code
|   |-- app/                         # Android application module (Kotlin source, layouts)
|   |-- build.gradle.kts             # Module Gradle configuration
|   |-- settings.gradle.kts          # Project settings and repository configuration
|   |-- gradlew.bat                  # Gradle wrapper executable (Windows)
|   `-- README.md                    # Android-specific build and installation documentation
`-- README.md                        # Primary project documentation
```

---

## Installation and Local Setup

### Prerequisites
- Python 3.10 or higher
- Git
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SeriySpray/SwiftFinance.git
   cd SwiftFinance
   ```

2. **Configure Python Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install flask gunicorn requests python-dotenv
   ```

4. **Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   SECRET_KEY=your_super_secret_session_key
   GROQ_API_KEY=your_groq_api_key_here
   PORT=5001
   ```

5. **Start Local Development Server**:
   ```bash
   python app_server.py
   ```
   Open your browser at `http://localhost:5001`.

---

## Production Deployment

The project includes an automated deployment script (`deploy.sh`) targeting an Oracle Cloud Ubuntu VPS.

### Deployment Workflow
1. Push local changes to the remote repository.
2. Execute the deployment script:
   ```bash
   ./deploy.sh
   ```
3. The deployment script performs the following operations:
   - Syncs code to `/home/ubuntu/SwiftFinance` via SSH/rsync.
   - Updates Python dependencies in the remote virtual environment.
   - Executes database migration checks (`update_server.py`).
   - Reloads the `monofinance.service` systemd daemon.
   - Tests Nginx configuration and reloads the web server.
   - Validates HTTPS response at `https://monofinance.duckdns.org/`.

---

## Android Application

The `SwiftFinanceAndroid` directory contains a native companion application designed for rapid expense recording on the go.

### Android Capabilities
- Native voice recognition in Ukrainian via `SpeechRecognizer`.
- Intelligent NLP parsing that extracts purchase descriptions and amounts from complex sentences.
- Multi-item detection: splits dictations with conjunctions ("and", "plus", "+") into distinct expense items.
- Session cookie persistence: keeps users logged in across application launches.
- OLED black theme matching the desktop design.

### Building the APK
```bash
cd SwiftFinanceAndroid
./gradlew assembleDebug
```
The output APK will be located at `app/build/outputs/apk/debug/app-debug.apk`.

---

## Chronological Project History

Below is the complete development history and major milestones compiled from project logs and design sessions:

### July 2026

- **2026-07-15: Project Initialization and Metric Flow Design**
  - Designed core single-page application structure.
  - Implemented the Metric Flow charcoal/orange visual palette (`#20a034`).
  - Integrated 30-day SVG line trend graphs with responsive vector scaling.
  - Added real-time financial health insight cards and dynamic metrics calculation.
  - Complete Ukrainian localization across all interface components.

- **2026-07-16: Auto-Debits Scheduler and Polish**
  - Implemented automated recurring debit system with catch-up logic for missed days.
  - Built toast notification system for user actions.
  - Added compact transaction table views and clean ledger filtering.

- **2026-07-17: Cloud Deployment and Authentication**
  - Developed Flask REST API backend (`app_server.py`) and SQLite database schema.
  - Built secure session authentication and user profile management.
  - Added browser-to-server data migration tool ("Import Local Data").
  - Deployed first standalone instance to Oracle Cloud VPS behind Nginx.
  - Added responsive smartphone layout tested on iPhone 13 and POCO X6.

- **2026-07-18: Native Android Companion App**
  - Created standalone Kotlin Android project in `SwiftFinanceAndroid`.
  - Built speech recognition parser for Ukrainian language expense dictation.
  - Implemented OkHttp persistent CookieJar for seamless session synchronization.
  - Built multi-item parsing algorithm for compound voice entries.
  - Designed custom dark launcher icons and theme assets.

- **2026-07-19: Analytics Expansion and Theme Engine**
  - Added vector branding favicon (`favicon.svg`).
  - Built detailed daily expense breakdown view within the Analytics module.
  - Implemented desktop dark/light theme toggle with persistent preference storage.

- **2026-07-20: iOS PWA and Standalone Audio Support**
  - Configured PWA standalone mode for iOS and Android (`manifest.json`, `sw.js`).
  - Added floating microphone trigger for mobile voice dictation.
  - Provisioned Cloudflare HTTPS tunnel to support microphone access policies.

- **2026-07-22: Savings Goals Envelopes and Daily Limits**
  - Created interactive savings goal envelopes system with custom colors and icon tags.
  - Implemented deposit and withdrawal modals with live progress bars.
  - Added daily expense limit tracking card and responsive mobile card view for transaction history.

- **2026-07-31: Multi-Period Limit Carousel and Sliding Pill Filter**
  - Added spending limit modes: Daily, Weekly, and Monthly.
  - Implemented touch-enabled limit carousel with spending pacing indicators.
  - Redesigned transaction filter into a sliding pill indicator with swipe gesture support.

---

### August 2026

- **2026-08-01: AI Expense Categorization and Category Modal**
  - Integrated Groq Cloud API (`llama-3.3-70b-versatile`) for automatic expense tagging into 8 global categories.
  - Upgraded interface icons to Google Material Symbols.
  - Developed full-featured Category Details modal with historical spending breakdown and search fallback.

- **2026-08-01: Category Modal DOM Fix and AI Prompt Tuning**
  - Resolved DOM nesting issue for category details modal.
  - Refined AI categorization prompt for grocery item classification.

- **2026-08-02: User Account Isolation and Sample Data Bugfix**
  - Resolved sample data auto-seeding bug on empty real user profiles.
  - Corrected reserve calculation logic for the financial safety cushion.

- **2026-08-03: Liquidity Calculations and Theme Polish**
  - Updated safety cushion formula to factor in live positive cash balance.
  - Refined category pill contrast and delete icon visibility across dark and light themes.

- **2026-08-07: Voice Input Hardening and Desktop Layout Cleanup**
  - Implemented double-submit guard to prevent duplicate entries during rapid recording.
  - Added 600ms timeout guard for AI categorization requests.
  - Hidden redundant microphone trigger on desktop sidebar layouts.

- **2026-08-12: iOS PWA Whisper AI Voice Integration**
  - Implemented MediaRecorder audio capture fallback for iOS standalone PWA where Web Speech API is restricted.
  - Connected audio stream to Groq Whisper AI (`whisper-large-v3-turbo`) for Ukrainian audio transcription.
  - Enforced HTTPS requirement for microphone permissions.

- **2026-08-21: Calendar Navigation and MoM Analytics**
  - Built interactive Month/Year navigation bar (`< Month Year >`) and picker modal.
  - Dynamically connected all charts, category breakdowns, MoM analytics, and transaction logs to the selected calendar month.

- **2026-08-27: Envelope Isolation, Balance Normalization and Database Audit**
  - Fixed savings goal deletion bug by removing automated envelope reconstruction from transactions.
  - Normalized account balance formula to strict `balance = income - expenses`.
  - Isolated envelope operations from total account cashflow.
  - Updated expense form styling to brand purple accents.
  - Conducted full database audit on Oracle Cloud VPS confirming 100% calculation integrity across historical records.

- **2026-08-27: Desktop Limit Carousel Polish**
  - Hidden mobile swipe hint elements on screen resolutions wider than 768px.
  - Aligned limit period buttons to the right edge on desktop screens.
  - Updated PWA service worker cache version to `v59`.

---

## Security and Data Privacy

- **Password Hashing**: Passwords stored on the server are salted and hashed using modern cryptographic algorithms (`scrypt` via Werkzeug).
- **Session Security**: Session cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` attributes over HTTPS.
- **SQL Injection Prevention**: All database operations in `app_server.py` use parameterized SQL queries.
- **Local-Only Option**: Users who do not wish to sync with the server can utilize the full feature set in local mode without transmitting data over the network.

---

## License and Author

Created and maintained by **SeriySpray** (`cimbal859@gmail.com`).

All rights reserved. Released under the MIT License.
