import axios from 'axios';
import NodeCache from 'node-cache';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';

const apiCache = new NodeCache({ stdTTL: 600 }); 
const categoryCache = new NodeCache({ stdTTL: 86400 });
const promptCache = new NodeCache({ stdTTL: 604800 }); 

// API 키 체크
if (!process.env.GEMINI_API_KEY) {
    logger.error("GEMINI_API_KEY is missing in .env file");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class YoutubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  calculateEngagement(views, likes, comments) {
    if (views === 0) return 0;
    return ((likes + comments) / views) * 100;
  }

  getDateFromPeriod(period) {
    const now = new Date();
    switch (period) {
      case '1w': now.setDate(now.getDate() - 7); break;
      case '2w': now.setDate(now.getDate() - 14); break;
      case '1m': now.setMonth(now.getMonth() - 1); break;
      default: now.setDate(now.getDate() - 7);
    }
    return now;
  }

  async getVideoCategories(regionCode) {
    const cacheKey = `categories_${regionCode}`;
    let categories = categoryCache.get(cacheKey);
    if (categories) return categories;

    try {
      const response = await axios.get(`${this.baseUrl}/videoCategories`, {
        params: { part: 'snippet', regionCode: regionCode, key: this.apiKey }
      });
      categories = response.data.items.map(item => ({
        id: item.id,
        title: item.snippet.title
      }));
      categoryCache.set(cacheKey, categories);
      return categories;
    } catch (error) {
      logger.error(`Category Fetch Error: ${error.message}`);
      return [];
    }
  }

  async getTrends(regionCode, period, categoryId) {
    const cacheKey = `trends_v4_${regionCode}_${period}_${categoryId || 'all'}`;
    let items = apiCache.get(cacheKey);

    if (!this.apiKey) throw new Error('YouTube API key is missing.');

    if (!items) {
      try {
        const requestParams = {
          part: 'snippet,statistics,contentDetails',
          chart: 'mostPopular',
          regionCode: regionCode,
          maxResults: 50,
          key: this.apiKey
        };

        if (categoryId && categoryId !== '0') {
          requestParams.videoCategoryId = categoryId;
        }
        
        const response = await axios.get(`${this.baseUrl}/videos`, {
          params: requestParams,
          timeout: 15000
        });

        items = response.data.items || [];
        apiCache.set(cacheKey, items);
      } catch (error) {
        if (error.response) {
          logger.error(`YouTube API Error: ${JSON.stringify(error.response.data)}`);
        } else {
          logger.error(`YouTube API Connection Error: ${error.message}`);
        }
        throw new Error('Failed to fetch YouTube trends.');
      }
    }

    const cutOffDate = this.getDateFromPeriod(period);
    
    const analyzedVideos = items
      .filter(item => {
        const publishedAt = new Date(item.snippet.publishedAt);
        return publishedAt >= cutOffDate;
      })
      .map(item => {
        const stats = item.statistics;
        const viewCount = parseInt(stats.viewCount || '0');
        const likeCount = parseInt(stats.likeCount || '0');
        const commentCount = parseInt(stats.commentCount || '0');
        const engagementRate = this.calculateEngagement(viewCount, likeCount, commentCount);
        
        const durationSec = this.parseDuration(item.contentDetails.duration);
        const isShort = durationSec <= 60;

        return {
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          tags: item.snippet.tags || [],
          categoryId: item.snippet.categoryId,
          isShort: isShort,
          durationSec: durationSec,
          stats: {
            views: viewCount,
            likes: likeCount,
            comments: commentCount,
            engagementRate: engagementRate.toFixed(2)
          },
          viewCountFmt: viewCount.toLocaleString(),
          likeCountFmt: likeCount.toLocaleString(),
        };
      });

    analyzedVideos.sort((a, b) => b.stats.views - a.stats.views);

    // 키워드 추출
    const keywords = this.extractKeywords(analyzedVideos);

    return {
      meta: { region: regionCode, period, totalResults: analyzedVideos.length },
      topVideos: analyzedVideos,
      keywords: keywords
    };
  }

  async analyzeWithAI(videos, region, filterContext) {
    if (!process.env.GEMINI_API_KEY) {
      return "<p>AI API 키가 서버에 설정되지 않았습니다. .env 파일을 확인해주세요.</p>";
    }

    try {
      const targetVideos = videos.slice(0, 15);
      const summaryData = targetVideos.map(v => 
        `- [${v.isShort ? 'Shorts' : 'Video'}] ${v.title} (${v.viewCountFmt}회, 반응률: ${v.stats.engagementRate}%) / 태그: ${v.tags.slice(0, 3).join(', ')}`
      ).join('\n');

      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

      const prompt = `
        역할: 마케팅 데이터 분석가
        지역: ${region}
        필터조건: ${filterContext}
        
        데이터(상위 15개):
        ${summaryData}

        분석요청:
        1. 현재 트렌드를 관통하는 핵심 키워드 3가지와 그 이유를 꼽아주세요.
        2. 조회수 대비 반응률이 좋은 콘텐츠들의 공통적인 특징(제목, 소재 등)을 분석하세요.
        3. 마케터가 지금 활용해야 할 숏폼/롱폼 콘텐츠 아이디어 3가지를 제안하세요.
        4. 트렌드 유입에 효과적인 해시태그 5개를 선정하세요.

        출력형식: HTML 태그(<h3>, <ul>, <li>, <strong>, <span class="highlight">)를 사용하여 가독성 좋게 작성해주세요.
        문체: 전문적이면서도 이해하기 쉽게 작성해주세요.
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return text;

    } catch (error) {
      logger.error(`Gemini AI Error Details: ${error.message}`);
      
      if (error.message.includes('API_KEY_INVALID')) {
        return "<p>API 키가 유효하지 않습니다. 설정을 확인해주세요.</p>";
      }
      if (error.message.includes('429')) {
        return "<p>AI 요청 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.</p>";
      }
      
      return `<p>AI 분석 중 오류가 발생했습니다. (${error.message})</p>`;
    }
  }

  async generateVideoPrompt(videoData, duration = 40) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const durationInt = parseInt(duration) || 40;
    const sceneCount = Math.ceil(durationInt / 5); // 5초 단위로 분할 (예: 40초 -> 8씬)
    
    const videoId = videoData.id || videoData.title.replace(/\s+/g, '_');
    const cacheKey = `prompt_shorts_${videoId}_${durationInt}`; // 캐시 키 변경
    const cachedPrompt = promptCache.get(cacheKey);

    if (cachedPrompt) {
      logger.info(`Serving Shorts prompt from cache: ${videoId} (${durationInt}s, ${sceneCount} scenes)`);
      return cachedPrompt;
    }

    try {
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      
      // [핵심] 분석 영상의 인사이트가 반영된 시스템 프롬프트
      const prompt = `
      Role: Expert AI Video Director specializing in viral YouTube Shorts.
      Task: Create a cohesive video generation storyboard for a ${durationInt}-second YouTube Short based on the following video metadata.
      
      Input Data:
      - Title: ${videoData.title}
      - Original Description: ${videoData.description ? videoData.description.substring(0, 500) : 'N/A'}
      - Tags: ${videoData.tags ? videoData.tags.join(', ') : 'N/A'}
      - Duration: ${videoData.durationSec} seconds
      - Views: ${videoData.stats.views}
      - Engagement Rate: ${videoData.stats.engagementRate}%
      
      **Critical Rules for Viral Shorts (Based on Algorithm Analysis):**
      1. **Structure**: The video MUST be divided into exactly ${sceneCount} scenes (each representing 5 seconds).
      2. **The Hook (Scene 1)**: Must be visually arresting or pose a question ("Curiosity Gap"). NO boring intros.
      3. **Pacing**: Fast and dynamic. Every scene must have specific camera movement (Pan, Zoom, Tracking).
      4. **Consistency**: Maintain consistent character/style across all prompts (using --cref or style descriptors).
      5. **AI Optimization**: Each prompt must be optimized for Runway Gen-3/Sora (5-second generation window).
      6. **Vertical Format**: All prompts must specify --ar 9:16 for mobile viewing.
      7. **Trend Integration**: Incorporate viral elements from the original video's success factors.

      Output JSON Format:
      {
        "global_concept": {
          "title": "Viral Short Concept Title",
          "style_prompt": "Cinematic 4k, vertical 9:16, high contrast, vibrant colors",
          "character_prompt": "Description of the main subject to maintain consistency",
          "viral_elements": "Key viral factors extracted from the original video"
        },
        "storyboard": [
          {
            "frame_number": 1,
            "duration": "0s - 5s",
            "shot_type": "Close-up / Dynamic Zoom",
            "visual_description": "THE HOOK: Visual description of the opening scene that grabs attention immediately.",
            "lighting": "Dramatic studio lighting",
            "camera_movement": "Fast zoom in with slight shake",
            "full_prompt": "Hyper-realistic video of [Subject doing Action], fast motion, 8k, --ar 9:16 --motion 8"
          },
          ... (Repeat for ${sceneCount} scenes)
        ]
      }
      
      IMPORTANT: Create exactly ${sceneCount} scenes in the storyboard array. Each scene should build upon the previous one to create a cohesive viral narrative.
      `;

      const result = await model.generateContent(prompt);
      const textData = result.response.text();

      if (textData && textData.length > 50) {
        promptCache.set(cacheKey, textData);
      }

      return textData;
    } catch (error) {
      logger.error(`Shorts Prompt Generation Error: ${error.message}`);
      throw new Error("숏츠 프롬프트 생성에 실패했습니다.");
    }
  }

  /**
   * 상세 비디오 스크립트 및 AI 비디오 생성 프롬프트 분석
   */
  async generateDetailedVideoScript(videoData, targetDuration = 15) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const videoId = videoData.id;
    const cacheKey = `script_video_${videoId}_${targetDuration}s`;
    const cachedScript = promptCache.get(cacheKey);

    if (cachedScript) {
      logger.info(`Serving video script from cache: ${videoId} (${targetDuration}s)`);
      return cachedScript;
    }

    try {
      const model = genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        You are an elite Film Director and Technical Video Analyst specializing in SHORT-FORM content. 
        Your task is to create a precise ${targetDuration}-second video script with AI generation prompts for tools like Sora, Runway Gen-3, Pika.

        **Target Video Metadata:**
        - Title: ${videoData.title}
        - Channel: ${videoData.channelTitle}
        - Original Duration: ${videoData.durationSec} seconds
        - Description: ${videoData.description ? videoData.description.substring(0, 800) : 'N/A'}
        - Tags: ${videoData.tags ? videoData.tags.join(', ') : 'N/A'}

        **CRITICAL REQUIREMENT:**
        - Create a ${targetDuration}-second short-form video script
        - Divide into 4-6 scenes that EXACTLY total ${targetDuration} seconds
        - Each scene should be 2-5 seconds long
        - Time ranges MUST be accurate (e.g., 0:00-0:03, 0:03-0:07, etc.)
        - Final scene MUST end at exactly 0:${targetDuration.toString().padStart(2, '0')}

        **Scene Breakdown Strategy:**
        1. **Hook (0-3s):** Immediate attention grabber
        2. **Build-up (3-8s):** Main content/story development
        3. **Climax (8-12s):** Peak moment/key message
        4. **Outro (12-${targetDuration}s):** Call-to-action or memorable ending

        **For Each Scene, Provide:**
        - **Exact time_range:** Must be sequential and total ${targetDuration}s
        - **Camera:** Angles, Movement (Pan/Tilt/Dolly/FPV), Lens type
        - **Characters & Costume:** Detailed appearance, clothing, colors
        - **Environment:** Location, lighting (Natural/Studio/Neon), atmosphere
        - **Action/Direction:** What happens? Pacing?
        - **AI Video Prompt:** Optimized for AI video generators with motion/camera parameters

        **Output Format (JSON Only):**
        {
          "director_notes": {
            "genre": "String (e.g., Vlog, Cinematic, Tech Review)",
            "overall_mood": "String",
            "pacing": "Fast-paced / Dynamic / Smooth",
            "color_grading": "String (e.g., Teal & Orange, Pastel, High Contrast)",
            "target_duration": "${targetDuration}s"
          },
          "scenes": [
            {
              "time_range": "0:00 - 0:03",
              "section_type": "Hook",
              "visual_description": "Detailed description of what is visible.",
              "technical_details": {
                "camera_angle": "String",
                "camera_movement": "String",
                "lighting": "String",
                "lens_choice": "String"
              },
              "subject_details": {
                "characters": "Description of people (if any)",
                "costume": "Clothing details",
                "acting_direction": "Expression and movement"
              },
              "location_bg": "Background description",
              "video_gen_prompt": "Highly detailed prompt for AI Video Generator. Include --motion or --camera parameters. Example: 'FPV drone shot swooping through neon-lit city streets at night, cinematic lighting, 4K --motion fast --camera dynamic'"
            }
          ]
        }
        
        IMPORTANT: Generate 4-6 scenes that EXACTLY total ${targetDuration} seconds. Verify time ranges are sequential and accurate.
      `;

      const result = await model.generateContent(prompt);
      const textData = result.response.text();
      
      promptCache.set(cacheKey, textData);
      return textData;

    } catch (error) {
      logger.error(`Video Script Generation Error: ${error.message}`);
      throw new Error(`비디오 스크립트 생성 실패: ${error.message}`);
    }
  }

  /**
   * Gemini API를 사용하여 이미지 생성
   */
  async generateImage(prompts, config = {}) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("API Key missing");
    }

    try {
      // 환경 변수에서 모델명 사용
      const imageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
      const model = genAI.getGenerativeModel({ 
        model: imageModel
      });

      const imageBase64s = [];
      
      // 여러 프롬프트를 일괄적으로 처리
      for (const prompt of prompts) {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"]
          }
        });

        // 결과에서 Base64 이미지 데이터 추출
        const response = result.response;
        if (response && response.candidates && response.candidates.length > 0) {
          const parts = response.candidates[0].content.parts;
          const imagePart = parts.find(p => p.inlineData);
          
          if (imagePart) {
            imageBase64s.push(imagePart.inlineData.data);
          } else {
            logger.warn(`Image not generated (no inlineData) for prompt: ${prompt.substring(0, 30)}...`);
          }
        } else {
          logger.warn(`No response or candidates for prompt: ${prompt.substring(0, 30)}...`);
        }
      }
      
      if (imageBase64s.length === 0) {
        throw new Error("생성된 이미지가 없습니다.");
      }
      
      return imageBase64s;

    } catch (error) {
      logger.error(`Gemini Image Generation Error: ${error.message}`);
      if (error.message.includes('API_KEY_INVALID')) {
        throw new Error("API 키가 유효하지 않습니다.");
      }
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error("해당 모델을 찾을 수 없습니다. API 키 권한이나 모델명을 확인해주세요.");
      }
      throw new Error(`이미지 생성 실패: ${error.message}`);
    }
  }

  extractKeywords(videos) {
    const keywordMap = new Map();
    
    // 상위 20개 영상에서 키워드 추출
    const topVideos = videos.slice(0, 20);
    
    topVideos.forEach(video => {
      // 조회수 기반 가중치
      const weightFactor = Math.log10(video.stats.views + 1) / 6; // 정규화
      
      // 제목에서 키워드 추출
      const titleWords = this.extractWords(video.title);
      titleWords.forEach(word => {
        if (word.length > 1 && !this.isStopWord(word)) {
          keywordMap.set(word, (keywordMap.get(word) || 0) + (2 * weightFactor));
        }
      });
      
      // 태그에서 키워드 추출
      if (video.tags && video.tags.length > 0) {
        video.tags.forEach(tag => {
          const tagWords = this.extractWords(tag);
          tagWords.forEach(word => {
            if (word.length > 1 && !this.isStopWord(word)) {
              keywordMap.set(word, (keywordMap.get(word) || 0) + (1 * weightFactor));
            }
          });
        });
      }
    });
    
    // 키워드 정렬 및 변환
    const sortedKeywords = Array.from(keywordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15) // 상위 15개 키워드
      .map(([text, weight]) => ({
        text,
        weight: Math.round(weight * 100) / 100
      }));
    
    return sortedKeywords;
  }

  extractWords(text) {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s\uac00-\ud7af\u3130-\u318f]/g, '') // 영어, 숫자, 한글만保留
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  isStopWord(word) {
    const stopWords = [
      // 한국어 불용어
      '이', '그', '저', '것', '들', '의', '가', '을', '를', '에', '에서', '와', '과', '도',
      '으로', '만', '까지', '부터', '보다', '처럼', '같이', '하고', '하는', '된', '된다',
      // 영어 불용어
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
      // 기타
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those'
    ];
    
    return stopWords.includes(word);
  }
}

export default new YoutubeService();