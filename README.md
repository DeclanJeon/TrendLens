## 🚀 TrendLens: AI-Powered YouTube Trend Analysis for Marketers & Creators

TrendLens is an advanced, AI-driven tool designed to empower marketers and content creators by transforming raw YouTube trend data into actionable marketing insights and creative content generation prompts. Leveraging the **YouTube Data API v3** and **Google Gemini**, it moves beyond simple analytics to provide a complete content strategy solution.

**Project Name:** TrendLens

**Project Description:** AI-Powered YouTube Trend Analysis for Marketers & Creators.

-----

### ✨ Key Features

  * **Global Trend Analysis:** Analyze trending videos across multiple regions (KR, US, JP) with time-frame filtering (1w, 2w, 1m).
  * **Gemini AI Insight Report:** Generates professional market analysis reports, identifying core keywords, viral content patterns, and actionable content ideas using Google Gemini.
  * **Short-Form Content Strategy:** Creates algorithm-optimized, frame-by-frame **Image Storyboard Prompts** and detailed **Video Generation Scripts** for AI tools (like Sora/Runway).
  * **AI Image Generation (Beta):** Integrates with a dedicated AI API (NanoBanana) to generate visual storyboards directly from the generated prompts.
  * **Data Optimization:** Utilizes **Node-Cache** for fast response times and efficient **YouTube API quota management**.
  * **Intuitive UI/UX:** A modern, glassmorphism-style user interface with interactive filtering (keywords, view counts, categories).
  * **Structured Logging:** Implements **Winston** for robust, centralized error and information logging.

-----

### 💻 Technology Stack

Following the **SOLID** and **KISS** principles, the project uses a modern, lightweight, and scalable full-stack JavaScript architecture.

#### Frontend

  * **HTML5, CSS3, Vanilla JavaScript (ES6+):** Pure, performance-optimized client-side logic.
  * **Vanta.js / THREE.js:** Interactive 3D background for a premium aesthetic.
  * **GSAP (GreenSock):** Smooth, performant UI animations.
  * **XLSX:** Client-side data export capability (CSV, Excel, JSON).
  * **Marked:** Markdown rendering for AI reports.

#### Backend

  * **Node.js (Express.js):** Fast, non-blocking server framework.
  * **Google Gemini API (`@google/generative-ai`):** Core AI engine for analysis and prompt generation.
  * **YouTube Data API v3:** Primary data acquisition.
  * **Node-Cache:** In-memory caching for API response optimization.
  * **Winston:** Centralized, structured logging for operational excellence.
  * **Dotenv:** Environment variable management.

-----

### ⚙️ Installation and Setup

#### 1\. Prerequisites

  * Node.js (v14+)
  * npm or yarn
  * API Keys: YouTube Data API v3, Google Gemini API, NanoBanana API

#### 2\. API Key Generation

Refer to the original `README.md` for detailed steps.

#### 3\. Project Initialization

```bash
# Clone the repository
git clone <repository-url>
cd youtube-trend-marketer

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Fill in your actual keys in the .env file:
# PORT=3000
# YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY_HERE
# GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
# NANOBANANA_API_KEY=YOUR_NANOBANANA_API_KEY_HERE
# NODE_ENV=development
```

#### 4\. Running the Project

To maintain optimal development workflow, the client and server run concurrently.

```bash
# Development Mode (Server + Vite Client)
npm run dev

# Server only (with nodemon)
npm run dev:server

# Client only (with Vite)
npm run dev:client

# Production Build
npm run build

# Production Start (Uses built /dist folder)
npm start
```

| Environment | Endpoint | Notes |
| :--- | :--- | :--- |
| **Development** | `http://localhost:5173` | Proxies API requests to port 3000. |
| **Production** | `http://localhost:3000` | Served by Express. |

-----

### 🛣️ API Endpoints

The Express server handles all data fetching and AI processing.

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/trends` | Fetches filtered, cached YouTube trending videos and extracts keywords. | `region`, `period`, `categoryId` |
| `GET` | `/api/categories` | Fetches video category IDs for a region. | `region` |
| `POST` | `/api/analyze-ai` | Analyzes filtered video data using Gemini and provides marketing insights. | N/A |
| `POST` | `/api/generate-prompt` | Generates detailed **Image Storyboard** and **Video Script** prompts for a specific video. | N/A |
| `POST` | `/api/generate-image` | Uses NanoBanana API via server to generate images from prompts. | N/A |
| `POST` | `/api/generate-video-script` | Generates a detailed video script and AI video prompt. | N/A |

-----

### 📂 Project Structure

This modular structure supports future scalability and adheres to functional modularity principles.

```
project-root/
├── public/                 # Frontend Static Files
│   ├── index.html          # Main UI (Entry Point)
│   ├── css/
│   │   └── style.css       # Styling
│   └── js/
│       └── app.js          # Client-Side Logic
├── src/                    # Backend Source Code
│   ├── services/           
│   │   └── youtubeService.js # Core Logic, API Handlers, Caching, Gemini
│   └── utils/              
│       ├── logger.js       # Winston Structured Logging
│       └── nlpProcessor.js # Keyword Extraction (currently integrated into youtubeService)
├── server.js               # Express Server & API Routing
├── package.json            # Dependencies & Scripts
└── README.md               # Project Documentation
```

-----

### 🔮 Future Enhancements (Improvement Areas)

  * [ ] NLP를 활용한 키워드 분석 기능 추가 (Upgrade `nlpProcessor.js` to handle complex analysis).
  * [ ] 데이터베이스 연동으로 장기적인 트렌드 분석 (Implement database for long-term data storage).
  * [ ] 더 많은 지역 지원 (Expand region support).
  * [ ] 실시간 알림 기능 (Add real-time notifications for trend changes).
  * [ ] 데이터 내보내기 기능 (CSV, JSON) (Enhance and finalize export features).

-----

### 📄 License

This project is licensed under the **MIT License**.

### 🤝 Contributing

Contributions are welcome\! Please open an issue or submit a pull request for any suggested improvements.