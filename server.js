import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import youtubeService from './src/services/youtubeService.js';
import logger from './src/utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from dist in production, public in development
const staticPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');
app.use(express.static(staticPath));

// 카테고리 목록 조회
app.get('/api/categories', async (req, res) => {
    try {
        const { region = 'KR' } = req.query;
        const categories = await youtubeService.getVideoCategories(region);
        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 트렌드 데이터 조회
app.get('/api/trends', async (req, res) => {
  try {
    const { region = 'KR', period = '1w', categoryId = '0' } = req.query;
    const data = await youtubeService.getTrends(region, period, categoryId);
    
    let keywords = [];
    if (data.topVideos && data.topVideos.length > 0) {
      keywords = youtubeService.extractKeywords(data.topVideos);
    }
    
    res.json({ 
      success: true, 
      data: {
        ...data,
        keywords: keywords
      }
    });
  } catch (error) {
    logger.error(error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI 분석 (클라이언트에서 필터링된 현재 리스트를 받아 분석)
app.post('/api/analyze-ai', async (req, res) => {
  try {
    const { videos, region, filterContext } = req.body;
    if (!videos || videos.length === 0) {
        return res.status(400).json({ success: false, error: '분석할 데이터가 없습니다.' });
    }
    
    const insight = await youtubeService.analyzeWithAI(videos, region, filterContext);
    res.json({ success: true, insight });
  } catch (error) {
    logger.error(`AI Analysis Error: ${error.message}`);
    res.status(500).json({ success: false, error: 'AI Analysis failed' });
  }
});

// 개별 영상 컨셉 카피 (숏츠 알고리즘 기반 이미지 + 비디오 프롬프트 생성)
app.post('/api/generate-prompt', async (req, res) => {
  try {
        const { video, duration = 15 } = req.body;
        if (!video) {
            return res.status(400).json({ success: false, error: '비디오 데이터가 없습니다.' });
        }
        
        logger.info(`Generating prompts for ${duration}s short-form video`);
        
        // 이미지 스토리보드 프롬프트 생성 (프레임 수는 duration/3 정도로 계산)
        const frameCount = Math.ceil(duration / 3);
        const imagePromptResult = await youtubeService.generateVideoPrompt(video, frameCount);
        
        // 비디오 생성 프롬프트 생성 (duration 전달)
        const videoScriptResult = await youtubeService.generateDetailedVideoScript(video, duration);
        
        res.json({
            success: true,
            data: {
                imagePrompts: imagePromptResult,
                videoScript: videoScriptResult,
                duration: duration
            }
        });
    } catch (error) {
        logger.error(`Shorts Prompt Generation API Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// AI 이미지 생성 (새로운 엔드포인트 추가)
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompts, aspectRatio = '1:1' } = req.body;
        if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
            return res.status(400).json({ success: false, error: '유효한 프롬프트 배열이 없습니다.' });
        }
        
        // 이미지 생성 서비스 호출
        const imageBase64s = await youtubeService.generateImage(prompts, { aspectRatio });
        res.json({ success: true, data: imageBase64s });
    } catch (error) {
        logger.error(`Image Generation API Error: ${error.message}`);
        // 클라이언트에서 에러 메시지를 표시할 수 있도록 에러를 전달
        res.status(500).json({ success: false, error: error.message });
    }
});

// 상세 비디오 스크립트 생성 엔드포인트 추가
app.post('/api/generate-video-script', async (req, res) => {
    try {
        const { video } = req.body;
        if (!video) {
            return res.status(400).json({ success: false, error: '비디오 데이터가 없습니다.' });
        }
        
        // 비디오 스크립트 생성 서비스 호출
        const scriptResult = await youtubeService.generateDetailedVideoScript(video);
        res.json({ success: true, data: scriptResult });
    } catch (error) {
        logger.error(`Video Script API Error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Video script generation failed' });
    }
});

app.listen(PORT, () => {
  logger.info(`TrendLens Server running on http://localhost:${PORT}`);
});