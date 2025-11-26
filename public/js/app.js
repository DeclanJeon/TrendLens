// Import dependencies
import * as THREE from 'three';
import VANTA from 'vanta/dist/vanta.net.min';
import { gsap } from 'gsap';
import * as XLSX from 'xlsx';
import { marked } from 'marked';

// Make THREE available globally for Vanta
window.THREE = THREE;

document.addEventListener('DOMContentLoaded', () => {
    // --- Vanta.js Init (Optimized) ---
    try {
        VANTA.NET({
            el: "#vanta-bg",
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0xbb2649,
            backgroundColor: 0xffffff,
            points: 10.00,
            maxDistance: 20.00,
            spacing: 20.00
        });
    } catch (e) { console.log("3D BG Init Failed"); }

    // --- Variables ---
    let currentRegion = 'KR';
    let rawVideoData = []; 
    let filteredVideoData = [];
    let isProcessing = false; 
    let currentStoryboardData = null; // 스토리보드 데이터 저장 변수 추가
    let currentVideoScriptData = null; // 비디오 스크립트 데이터 저장 변수 추가
    let pendingVideoData = null; // 선택된 비디오 임시 저장 변수 추가
    let activeModalVideo = null; // [New] 모달이 열려있는 동안 유지될 비디오 데이터

    // --- Elements ---
    const regionBtns = document.querySelectorAll('.toggle-btn');
    const periodSelect = document.getElementById('periodSelect');
    const searchBtn = document.getElementById('searchBtn');
    
    const categorySelect = document.getElementById('categorySelect');
    const keywordInput = document.getElementById('keywordInput');
    const viewCountRange = document.getElementById('viewCountRange');
    const viewCountLabel = document.getElementById('viewCountLabel');
    
    const resultsArea = document.getElementById('resultsArea');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultCount = document.getElementById('resultCount');
    
    // Debug: Check if resultsArea exists
    if (!resultsArea) {
        console.error('ERROR: resultsArea not found!');
    }
    const aiSection = document.getElementById('aiSection');
    const aiTriggerBtn = document.getElementById('aiTriggerBtn');
    const aiInsightBox = document.getElementById('aiInsightBox');
    const aiContent = document.getElementById('aiContent');
    const loaderTemplate = document.getElementById('loaderTemplate');
    const closeAiBtn = document.querySelector('.close-ai');
    const exportBtns = document.querySelectorAll('.export-btn');

    // --- Modal Elements (New) ---
    const promptModal = document.getElementById('promptModal');
    const closeModalBtn = document.querySelector('.close-modal');
    const promptResult = document.getElementById('promptResult');
    const promptLoading = document.getElementById('promptLoading');
    const copyPromptBtn = document.getElementById('copyAllBtn'); // ID 수정
    
    // --- New Modal Elements ---
    const frameSelectionModal = document.getElementById('frameSelectionModal');
    const frameSelectBtns = document.querySelectorAll('.frame-select-btn');
    
    // --- Tab Elements (New) ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // --- Image Generation Elements (New) ---
    const generateImageBtn = document.getElementById('generateImageBtn');
    const imageGrid = document.getElementById('imageGrid');
    const imageResultContainer = document.getElementById('imageResultContainer');

    // --- Keyword Cloud Elements ---
    const keywordCloudSection = document.getElementById('keywordCloudSection');
    const keywordContainer = document.getElementById('keywordContainer');

    // --- Init ---
    fetchCategories(currentRegion);

    // --- Event Listeners ---
    regionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            regionBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentRegion = e.target.dataset.value;
            fetchCategories(currentRegion);
        });
    });

    searchBtn.addEventListener('click', fetchTrends);

    keywordInput.addEventListener('input', applyFilters);
    viewCountRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        viewCountLabel.innerText = val === 0 ? '0' : formatCompactNumber(val);
        applyFilters();
    });
    categorySelect.addEventListener('change', () => {
        if(rawVideoData.length > 0) fetchTrends(); 
    });

    aiTriggerBtn.addEventListener('click', triggerAIAnalysis);
    closeAiBtn.addEventListener('click', () => {
        gsap.to(aiInsightBox, { height: 0, opacity: 0, display: 'none', duration: 0.3 });
    });

    exportBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            exportData(type);
        });
    });

    // --- Modal Events (New) ---
    closeModalBtn.addEventListener('click', () => {
        promptModal.style.display = 'none';
        currentStoryboardData = null;
        currentVideoScriptData = null;
        activeModalVideo = null; // [New] 모달 닫을 때만 초기화
        
        // 탭 초기화 (스토리보드로 리셋)
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="storyboard"]').classList.add('active');
        document.getElementById('tabContent-storyboard').classList.add('active');
    });
    
    promptModal.addEventListener('click', (e) => {
        if (e.target === promptModal) promptModal.style.display = 'none';
    });
    
    // --- New Event Listener for Frame Selection ---
    frameSelectBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            frameSelectionModal.style.display = 'none';
            
            if (!pendingVideoData) return;
            
            // 데이터셋에서 duration 가져오기 (이전 코드: dataset.frames)
            // 버튼 내부 요소를 클릭할 수 있으므로 closest 사용
            const targetBtn = e.target.closest('.frame-select-btn');
            const duration = parseInt(targetBtn.dataset.duration);
            
            activeModalVideo = pendingVideoData;
            pendingVideoData = null;
            
            const video = activeModalVideo;
            
            // UI 피드백 처리
            const copyBtn = document.querySelector(`.card[data-video-id="${video.id}"] .btn-concept-copy`) ||
                            document.querySelector('.btn-concept-copy'); // 안전장치
            
            if (!copyBtn) return;
            
            const originalText = copyBtn.innerHTML;
            copyBtn.disabled = true;
            copyBtn.innerHTML = `<span class="spinner-tiny"></span> Designing ${duration}s shorts...`;
            
            try {
                // handleConceptCopy 함수 호출 시 duration 전달
                await handleConceptCopy(video, duration);
            } catch (error) {
                console.error('Error:', error);
                alert("An error occurred during processing: " + error.message);
            } finally {
                copyBtn.innerHTML = originalText;
                copyBtn.disabled = false;
            }
        });
    });

    // 이미지 일괄 생성 버튼 이벤트
    if (generateImageBtn) {
        generateImageBtn.addEventListener('click', () => {
            if (currentStoryboardData && currentStoryboardData.storyboard.length > 0) {
                // 전체 프롬프트 추출
                const prompts = currentStoryboardData.storyboard.map(f => ({
                    frame: f.frame_number,
                    prompt: f.full_prompt
                }));
                handleImageGeneration(prompts, generateImageBtn);
            } else {
                alert("Please generate storyboard first.");
            }
        });
    }

    // --- Tab Switching (New) ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            
            // 탭 UI 업데이트
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            const targetContent = document.getElementById(`tabContent-${targetTab}`);
            targetContent.classList.add('active');
            
            // Video Script 탭 선택 시 데이터가 없으면 로딩 시작
            if (targetTab === 'videoscript') {
                if (!currentVideoScriptData && activeModalVideo) {
                    // 기존 데이터가 없으면 스켈레톤/로딩 표시
                    renderScriptLoadingState();
                    fetchVideoScript(activeModalVideo);
                } else if (!activeModalVideo) {
                     document.getElementById('videoScriptResult').innerHTML =
                        '<div class="empty-state">비디오 데이터가 유실되었습니다. 다시 선택해주세요.</div>';
                }
            }
        });
    });

    // [New] 스크립트 로딩 상태 렌더링 함수
    function renderScriptLoadingState() {
        const scriptContainer = document.getElementById('videoScriptResult');
        const directorNotes = document.getElementById('directorNotes');
        const scriptTimeline = document.getElementById('scriptTimeline');
        
        scriptContainer.style.display = 'block';
        directorNotes.innerHTML = '<div class="skeleton-box" style="height: 150px;"></div>';
        scriptTimeline.innerHTML = `
            <div class="skeleton-scene"></div>
            <div class="skeleton-scene"></div>
            <div class="skeleton-scene"></div>
        `;
    }

    // --- Core Functions ---

    async function fetchCategories(region) {
        try {
            const res = await fetch(`/api/categories?region=${region}`);
            const json = await res.json();
            if (json.success) {
                categorySelect.innerHTML = '<option value="0">All Categories</option>';
                json.data.forEach(cat => {
                    categorySelect.innerHTML += `<option value="${cat.id}">${cat.title}</option>`;
                });
            }
        } catch (e) { console.error("Category fetch failed", e); }
    }

    async function fetchTrends() {
        const period = periodSelect.value;
        const categoryId = categorySelect.value;
        
        resultsArea.innerHTML = '';
        resultsArea.appendChild(loaderTemplate.content.cloneNode(true));
        aiSection.style.display = 'none';
        aiInsightBox.style.display = 'none';
        filterSection.classList.add('disabled');
        resultsHeader.style.display = 'none';

        try {
            const response = await fetch(`/api/trends?region=${currentRegion}&period=${period}&categoryId=${categoryId}`);
            const result = await response.json();

            if (result.success && result.data.topVideos) {
                rawVideoData = result.data.topVideos;
                
                renderKeywords(result.data.keywords);
                
                filterSection.classList.remove('disabled');
                applyFilters();
                
                aiSection.style.display = 'block';
                
                gsap.fromTo(resultsArea, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
            } else {
                showError(result.error || '데이터를 가져오지 못했습니다.');
            }
        } catch (error) {
            console.error(error);
            showError('서버 통신 오류 발생');
        }
    }

    function applyFilters() {
        const keyword = keywordInput.value.toLowerCase();
        const minViews = parseInt(viewCountRange.value);

        filteredVideoData = rawVideoData.filter(video => {
            const titleMatch = video.title.toLowerCase().includes(keyword);
            const tagMatch = video.tags.some(tag => tag.toLowerCase().includes(keyword));
            const viewMatch = video.stats.views >= minViews;
            
            return (titleMatch || tagMatch) && viewMatch;
        });

        renderResults(filteredVideoData);
    }

    function renderResults(videos) {
        resultsArea.innerHTML = '';
        resultCount.innerText = `Total ${videos.length} Videos Found`;
        resultsHeader.style.display = 'flex';
        
        if (videos.length === 0) {
            resultsArea.innerHTML = '<div class="empty-state glass-panel">No videos match the criteria.</div>';
            return;
        }

        videos.forEach((video) => {
            const card = document.createElement('div');
            const shortsClass = video.isShort ? 'is-shorts' : '';
            card.className = `card ${shortsClass}`;
            card.setAttribute('data-video-id', video.id); // 프레임 선택 로직을 위한 ID 추가
            
            const shortsBadge = video.isShort 
                ? `<div class="shorts-indicator">⚡ Shorts</div>` 
                : '';

            card.innerHTML = `
                <div class="card-thumb-wrapper">
                    ${shortsBadge}
                    <img src="${video.thumbnail}" class="card-thumb" loading="lazy" alt="${video.title}">
                </div>
                <div class="card-content">
                    <div class="card-title" title="${video.title}">${video.title}</div>
                    <div class="card-meta">
                        <span>${video.channelTitle}</span>
                        <span>${new Date(video.publishedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="card-stats">
                        <div>👁️ ${formatCompactNumber(video.stats.views)}</div>
                        <div class="stat-highlight">🔥 ${video.stats.engagementRate}%</div>
                    </div>
                    <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" class="card-link">VIEW ON YOUTUBE</a>
                    
                    <button class="btn-concept-copy">
                        🎨 Concept Copy
                    </button>
                </div>
            `;
            
            // 버튼에 직접 이벤트 리스너 바인딩
            const copyBtn = card.querySelector('.btn-concept-copy');
            if (copyBtn) {
                copyBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); 
                    console.log('Concept Copy Clicked:', video.title);
                    
                    if (isProcessing) {
                        console.log("Processing already in progress...");
                        return;
                    }
                    
                    // 1. 개수 선택 모달 띄우기 (새로운 로직)
                    pendingVideoData = video;
                    currentVideoScriptData = null; // 초기화
                    frameSelectionModal.style.display = 'flex';
                });
            }

            resultsArea.appendChild(card);
        });

        gsap.to(".card", {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.05,
            ease: "power2.out"
        });
    }

    async function triggerAIAnalysis() {
        if (filteredVideoData.length === 0) {
            alert("No data to analyze.");
            return;
        }

        const btn = document.getElementById('aiTriggerBtn');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<div class="spinner-small"></div> Analyzing with Gemini...';
        btn.disabled = true;

        aiInsightBox.style.display = 'block';
        aiInsightBox.style.opacity = 0;
        aiContent.innerHTML = '';

        const categoryName = categorySelect.options[categorySelect.selectedIndex].text;
        const filterContext = `카테고리: ${categoryName}, 검색어: ${keywordInput.value || '없음'}, 최소조회수: ${viewCountRange.value}`;

        try {
            const response = await fetch('/api/analyze-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    videos: filteredVideoData, 
                    region: currentRegion,
                    filterContext: filterContext
                })
            });
            const result = await response.json();
            
            if (result.success) {
                // 마크다운을 HTML로 변환
                const htmlContent = marked.parse(result.insight);
                aiContent.innerHTML = htmlContent;
                gsap.to(aiInsightBox, { opacity: 1, height: 'auto', duration: 0.5 });
            } else {
                aiContent.innerHTML = `<p style="color: #d32f2f;">Error: ${result.error || "Unknown error"}</p>`;
                gsap.to(aiInsightBox, { opacity: 1, height: 'auto' });
            }
        } catch (e) {
            aiContent.innerText = "네트워크 통신 오류입니다.";
            gsap.to(aiInsightBox, { opacity: 1, height: 'auto' });
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async function exportData(type) {
        if (filteredVideoData.length === 0) {
            alert("No data to export.");
            return;
        }

        const cleanData = filteredVideoData.map(v => ({
            Title: v.title,
            Channel: v.channelTitle,
            Views: v.stats.views,
            Likes: v.stats.likes,
            Comments: v.stats.comments,
            EngagementRate: v.stats.engagementRate + '%',
            Date: new Date(v.publishedAt).toLocaleDateString(),
            Type: v.isShort ? 'Shorts' : 'Video',
            Tags: v.tags.join(', '),
            Link: `https://www.youtube.com/watch?v=${v.id}`
        }));

        if (type === 'json') {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `trend_data_${Date.now()}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } else {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(cleanData);
            XLSX.utils.book_append_sheet(wb, ws, "Trends");
            
            if (type === 'csv') {
                XLSX.writeFile(wb, `trend_data_${Date.now()}.csv`);
            } else {
                XLSX.writeFile(wb, `trend_data_${Date.now()}.xlsx`);
            }
        }
    }

    // Concept Copy Handler (숏츠 알고리즘 기반)
    async function handleConceptCopy(video, duration) {
        promptModal.style.display = 'flex';
        promptModal.offsetHeight;
        
        promptResult.style.display = 'none';
        promptLoading.style.display = 'block';
        
        const globalCard = document.getElementById('globalStyleCard');
        const grid = document.getElementById('storyboardGrid');
        if (globalCard) globalCard.innerHTML = '';
        if (grid) grid.innerHTML = '';
        
        // 이미지 결과 영역 초기화 - COMMENTED OUT
        // imageResultContainer.style.display = 'none';
        // imageGrid.innerHTML = '';
        
        try {
            // duration 파라미터로 숏츠 기반 프롬프트 생성 요청
            const response = await fetch('/api/generate-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video, duration })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 이미지 프롬프트 파싱
                let imageJsonStr = result.data.imagePrompts;
                imageJsonStr = imageJsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
                
                let imageStoryData;
                try {
                    imageStoryData = JSON.parse(imageJsonStr);
                } catch (parseError) {
                    console.error("Image JSON Parse Error:", imageJsonStr);
                    throw new Error("이미지 프롬프트 해석 실패");
                }
                
                // 비디오 스크립트 파싱
                let videoJsonStr = result.data.videoScript;
                videoJsonStr = videoJsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
                
                let videoScriptData;
                try {
                    videoScriptData = JSON.parse(videoJsonStr);
                } catch (parseError) {
                    console.error("Video JSON Parse Error:", videoJsonStr);
                    throw new Error("비디오 스크립트 해석 실패");
                }
                
                // 헤더 업데이트 (숏츠 정보 표시)
                const headerSub = document.querySelector('.header-sub');
                headerSub.innerText = `${duration}s Short-form Production Guide - ${imageStoryData.storyboard.length} Image Frames + ${videoScriptData.scenes?.length || 0} Video Scenes`;
                
                // 두 가지 프롬프트 모두 렌더링
                renderStoryboard(imageStoryData, videoScriptData, duration);
                
                promptLoading.style.display = 'none';
                promptResult.style.display = 'block';
            } else {
                throw new Error(result.error || "서버 오류");
            }
        } catch (error) {
            console.error('Shorts Prompt Generation Error:', error);
            promptLoading.style.display = 'none';
            promptResult.style.display = 'block';
            
            if (globalCard) {
                const errorMsg = error.message || "알 수 없는 오류가 발생했습니다.";
                const isQuotaError = errorMsg.includes('할당량') || errorMsg.includes('quota');
                
                globalCard.innerHTML = `
                    <div class="empty-state" style="color: #d32f2f; border: 1px solid #ffcdd2; background: #ffebee; padding: 20px; border-radius: 8px;">
                        <h3>⚠️ 숏츠 프롬프트 생성 실패</h3>
                        <p style="font-size: 1rem; margin: 10px 0;">${errorMsg}</p>
                        ${isQuotaError ? `
                            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; margin-top: 12px;">
                                <strong>💡 해결 방법:</strong>
                                <ul style="text-align: left; margin: 8px 0 0 20px; color: #856404;">
                                    <li>몇 분 후 다시 시도해주세요</li>
                                    <li>서버 관리자에게 API 키 교체를 요청하세요</li>
                                    <li>Gemini API 콘솔에서 할당량을 확인하세요</li>
                                </ul>
                            </div>
                        ` : `
                            <p style="font-size:0.8rem; margin-top:10px; color:#666;">잠시 후 다시 시도해주세요.</p>
                        `}
                    </div>
                `;
            }
        }
    }

    function renderStoryboard(imageData, videoData, duration) {
        currentStoryboardData = imageData; // 이미지 데이터 저장
        const globalCard = document.getElementById('globalStyleCard');
        const grid = document.getElementById('storyboardGrid');
        
        // 이미지 프롬프트 섹션
        globalCard.innerHTML = `
            <h2 style="color: var(--primary-100); margin-bottom: 1.5rem; font-size: 1.5rem;">📸 Image Generation Prompts</h2>
            <div class="style-title">🎥 Concept: ${imageData.global_concept.title}</div>
            <div class="style-row">
                <span class="style-tag">STYLE</span> ${imageData.global_concept.style_prompt}
            </div>
            <div class="style-row">
                <span class="style-tag">CHARACTER</span> ${imageData.global_concept.character_prompt}
            </div>
        `;
        
        grid.innerHTML = '';
        
        // 이미지 프롬프트 프레임 렌더링
        imageData.storyboard.forEach(frame => {
            const card = document.createElement('div');
            card.className = 'frame-card';
            
            const safePrompt = frame.full_prompt.replace(/"/g, "'"); // 프롬프트 내 큰따옴표 이스케이프 처리
            card.innerHTML = `
                <div class="frame-header">
                    <span class="frame-num">Frame ${frame.frame_number}</span>
                    <span class="shot-type">${frame.shot_type}</span>
                </div>
                <div class="frame-desc">
                    <strong>Scene:</strong> ${frame.visual_description}
                </div>
                <div class="frame-lighting">💡 ${frame.lighting}</div>
                <!-- <button class="btn-generate-frame-image" data-prompt="${safePrompt}" style="margin-bottom: 8px; background: var(--accent-100); color: var(--primary-100);">
                    📸 Image
                </button> -->
                <button class="btn-copy-frame">
                    <span>✂️ Copy Prompt</span>
                </button>
            `;
            
            // 프롬프트 복사 버튼 이벤트 리스너
            const copyBtn = card.querySelector('.btn-copy-frame');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(frame.full_prompt).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<span>✅ Copied!</span>';
                    copyBtn.style.background = 'var(--primary-100)';
                    copyBtn.style.color = 'white';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.background = 'white';
                        copyBtn.style.color = 'var(--primary-100)';
                    }, 1500);
                });
            });
            
            // 개별 이미지 생성 버튼 이벤트 리스너 추가 - COMMENTED OUT
            /*
            const frameImageBtn = card.querySelector('.btn-generate-frame-image');
            frameImageBtn.addEventListener('click', (e) => {
                const prompt = e.target.dataset.prompt;
                if (!isProcessing) {
                    // 개별 이미지 생성 요청 (프롬프트 1개)
                    handleImageGeneration([prompt], frameImageBtn, frame.frame_number); 
                }
            });
            */
            
            grid.appendChild(card);
        });
        
        // 비디오 스크립트 섹션 추가
        if (videoData && videoData.scenes) {
            const videoSection = document.createElement('div');
            videoSection.style.marginTop = '3rem';
            videoSection.innerHTML = `
                <h2 style="color: var(--primary-200); margin-bottom: 1.5rem; font-size: 1.5rem;">🎬 Video Generation Script (${duration || videoData.director_notes.target_duration || ''}s Short-form)</h2>
                <div class="style-card" style="margin-bottom: 1.5rem;">
                    <div class="style-title">🎭 Director's Notes</div>
                    <div class="style-row"><span class="style-tag">DURATION</span> ${duration || videoData.director_notes.target_duration || 'N/A'}s</div>
                    <div class="style-row"><span class="style-tag">GENRE</span> ${videoData.director_notes.genre}</div>
                    <div class="style-row"><span class="style-tag">MOOD</span> ${videoData.director_notes.overall_mood}</div>
                    <div class="style-row"><span class="style-tag">PACING</span> ${videoData.director_notes.pacing}</div>
                    <div class="style-row"><span class="style-tag">COLOR</span> ${videoData.director_notes.color_grading}</div>
                </div>
            `;
            
            const videoGrid = document.createElement('div');
            videoGrid.className = 'storyboard-grid';
            videoGrid.style.marginTop = '1rem';
            
            videoData.scenes.forEach(scene => {
                const sceneCard = document.createElement('div');
                sceneCard.className = 'frame-card';
                sceneCard.innerHTML = `
                    <div class="frame-header">
                        <span class="frame-num">${scene.time_range}</span>
                        <span class="shot-type">${scene.section_type}</span>
                    </div>
                    <div class="frame-desc">
                        <strong>Visual:</strong> ${scene.visual_description}
                    </div>
                    <div class="frame-desc" style="margin-top: 0.5rem;">
                        <strong>Camera:</strong> ${scene.technical_details.camera_angle} | ${scene.technical_details.camera_movement}
                    </div>
                    <div class="frame-desc" style="margin-top: 0.5rem;">
                        <strong>Lighting:</strong> ${scene.technical_details.lighting}
                    </div>
                    ${scene.subject_details.characters ? `
                        <div class="frame-desc" style="margin-top: 0.5rem;">
                            <strong>Subject:</strong> ${scene.subject_details.characters}
                        </div>
                    ` : ''}
                    <div class="frame-lighting" style="margin-top: 1rem; background: var(--primary-300); padding: 0.8rem; border-radius: 8px;">
                        <strong>🎥 AI Video Prompt:</strong><br>
                        ${scene.video_gen_prompt}
                    </div>
                    <button class="btn-copy-frame" data-video-prompt="${scene.video_gen_prompt.replace(/"/g, '&quot;')}" style="margin-top: 0.5rem;">
                        <span>✂️ Copy Video Prompt</span>
                    </button>
                `;
                
                const copyBtn = sceneCard.querySelector('.btn-copy-frame');
                copyBtn.addEventListener('click', () => {
                    const prompt = copyBtn.dataset.videoPrompt;
                    navigator.clipboard.writeText(prompt).then(() => {
                        const originalHTML = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<span>✅ Copied!</span>';
                        copyBtn.style.background = 'var(--primary-100)';
                        copyBtn.style.color = 'white';
                        setTimeout(() => {
                            copyBtn.innerHTML = originalHTML;
                            copyBtn.style.background = 'white';
                            copyBtn.style.color = 'var(--primary-100)';
                        }, 1500);
                    });
                });
                
                videoGrid.appendChild(sceneCard);
            });
            
            videoSection.appendChild(videoGrid);
            grid.parentElement.appendChild(videoSection);
        }
        
        // Copy All Button 이벤트 재설정
        const copyAllBtn = document.getElementById('copyAllBtn');
        const newCopyBtn = copyAllBtn.cloneNode(true);
        copyAllBtn.parentNode.replaceChild(newCopyBtn, copyAllBtn);
        
        newCopyBtn.addEventListener('click', () => {
            let allText = `=== Image Generation Prompts ===\n\n`;
            allText += `Global Style: ${imageData.global_concept.style_prompt} -- ${imageData.global_concept.character_prompt}\n\n`;
            allText += imageData.storyboard.map(f => 
                `[Frame ${f.frame_number} - ${f.shot_type}]\n${f.full_prompt}`
            ).join('\n\n');
            
            if (videoData && videoData.scenes) {
                allText += `\n\n=== Video Generation Script ===\n\n`;
                allText += videoData.scenes.map(s => 
                    `[${s.time_range} - ${s.section_type}]\n${s.video_gen_prompt}`
                ).join('\n\n');
            }
            
            navigator.clipboard.writeText(allText).then(() => {
                const originalText = newCopyBtn.innerText;
                newCopyBtn.innerText = "✅ All Prompts Copied!";
                setTimeout(() => newCopyBtn.innerText = originalText, 2000);
            });
        });
    }

    /**
     * 이미지 생성 요청 핸들러 - 순차 처리 로직 적용
     */
    async function handleImageGeneration(promptsInfo, triggerBtn) {
        if (isProcessing) return;
        
        const originalHTML = triggerBtn.innerHTML;
        isProcessing = true;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = `<span class="spinner-tiny"></span> Starting image generation...`;
        
        // 결과 컨테이너 표시 및 초기화
        imageResultContainer.style.display = 'block';
        imageGrid.innerHTML = ''; // 기존 이미지 클리어
        
        // 스켈레톤 UI 미리 생성
        promptsInfo.forEach(info => {
            const placeholder = document.createElement('div');
            placeholder.id = `img-placeholder-${info.frame}`;
            placeholder.className = 'frame-card skeleton-box';
            placeholder.style.height = '200px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.innerHTML = `<p style="font-size:0.8rem; color:#888;">Frame ${info.frame} waiting...</p>`;
            imageGrid.appendChild(placeholder);
        });

        try {
            // [핵심] 순차적 요청으로 변경 (서버/API 부하 방지)
            for (let i = 0; i < promptsInfo.length; i++) {
                const info = promptsInfo[i];
                const placeholder = document.getElementById(`img-placeholder-${info.frame}`);
                
                // 진행 상태 업데이트
                triggerBtn.innerHTML = `<span class="spinner-tiny"></span> Generating (${i + 1}/${promptsInfo.length})...`;
                if(placeholder) placeholder.innerHTML = `<div class="spinner-small" style="border-color:#555; border-top-color:transparent"></div>`;

                // 개별 이미지 요청
                const response = await fetch('/api/generate-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompts: [info.prompt], // 배열로 보내지만 1개씩 처리
                        aspectRatio: "1:1"
                    })
                });

                const result = await response.json();

                if (result.success && result.data && result.data.length > 0) {
                    // 성공 시 이미지 교체
                    const base64 = result.data[0];
                    if(placeholder) {
                        placeholder.className = 'frame-card'; // 스켈레톤 클래스 제거
                        placeholder.style.height = 'auto';
                        placeholder.innerHTML = `
                            <div style="position: relative; width: 100%; aspect-ratio: 1/1; overflow: hidden; border-radius: 8px;">
                                <img src="data:image/png;base64,${base64}" style="width: 100%; height: 100%; object-fit: cover; animation: fadeIn 0.5s;" alt="Frame ${info.frame}">
                                <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem;">#${info.frame}</div>
                            </div>
                            <a href="data:image/png;base64,${base64}" download="trendlens_frame_${info.frame}.png" class="btn-concept-copy" style="margin-top:10px; text-align:center; text-decoration:none; display:block;">
                                ⬇️ 저장
                            </a>
                        `;
                    }
                } else {
                    if(placeholder) placeholder.innerHTML = `<span style="color:red; font-size:0.8rem;">⚠️ Generation failed</span>`;
                }

                // API 속도 제한 고려하여 약간의 지연
                await new Promise(r => setTimeout(r, 1000));
            }

        } catch (error) {
            console.error('Image Generation Error:', error);
            alert(`Image generation error: ${error.message}`);
        } finally {
            triggerBtn.innerHTML = originalHTML;
            triggerBtn.disabled = false;
            isProcessing = false;
        }
    }

    /**
     * 생성된 이미지 결과를 HTML에 렌더링 - COMMENTED OUT
     */
    /*
    function renderGeneratedImages(base64Images, totalFrames, singleFrameNum = null) {
        const imageHtml = base64Images.map((base64, index) => {
            const frameNumDisplay = singleFrameNum ? `Frame ${singleFrameNum}` : `Frame ${index + 1}`;
            return `
                <div class="frame-card" style="padding: 0; overflow: hidden; position: relative;">
                    <img src="data:image/png;base64,${base64}" style="width: 100%; height: auto; display: block; object-fit: cover;" alt="AI Generated Image ${frameNumDisplay}">
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem;">
                        ${frameNumDisplay}
                    </div>
                    <a href="data:image/png;base64,${base64}" download="ai_image_${Date.now()}_${index+1}.png" 
                       style="position: absolute; bottom: 10px; right: 10px; background: var(--primary-100); color: white; padding: 6px 10px; border-radius: 6px; text-decoration: none; font-size: 0.8rem;">
                       ⬇️ Download
                    </a>
                </div>
            `;
        }).join('');
        
        if (singleFrameNum) {
            // 개별 생성 시 기존 콘텐츠를 덮어쓰거나 앞에 추가
            imageGrid.innerHTML = imageHtml;
        } else {
            // 일괄 생성 시 전체 덮어쓰기
            imageGrid.innerHTML = imageHtml;
        }
    }
    */

    function renderKeywords(keywords) {
        if (!keywords || keywords.length === 0) {
            keywordCloudSection.style.display = 'none';
            return;
        }
        
        keywordCloudSection.style.display = 'block';
        keywordContainer.innerHTML = '';
        
        const maxWeight = keywords[0].weight;
        keywords.forEach(k => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag';
            tag.innerText = `#${k.text}`;
            
            const size = 0.8 + (k.weight / maxWeight) * 0.7;
            tag.style.fontSize = `${size}rem`;
            
            tag.addEventListener('click', () => {
                keywordInput.value = k.text;
                applyFilters();
                
                document.querySelectorAll('.keyword-tag').forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
            });
            
            keywordContainer.appendChild(tag);
        });
        
        gsap.from(".keyword-tag", {
            opacity: 0,
            scale: 0.5,
            stagger: 0.03,
            duration: 0.4
        });
    }

    // Video Script Generation Function (New)
    async function fetchVideoScript(video) {
        if (!video) return;
        
        try {
            const response = await fetch('/api/generate-video-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video })
            });
            
            const result = await response.json();
            
            if (result.success) {
                currentVideoScriptData = result.data;
                renderVideoScript(result.data);
            } else {
                throw new Error(result.error || "비디오 스크립트 생성 실패");
            }
        } catch (error) {
            console.error('Video Script Generation Error:', error);
            const videoScriptResult = document.getElementById('videoScriptResult');
            if (videoScriptResult) {
                videoScriptResult.innerHTML = `
                    <div class="empty-state" style="color: #d32f2f; border: 1px solid #ffcdd2; background: #ffebee; padding: 20px; border-radius: 8px;">
                        <h3>⚠️ 비디오 스크립트 생성 실패</h3>
                        <p style="font-size: 1rem; margin: 10px 0;">${error.message}</p>
                        <p style="font-size:0.8rem; margin-top:10px; color:#666;">잠시 후 다시 시도해주세요.</p>
                    </div>
                `;
            }
        }
    }

    // Video Script Rendering Function (New)
    function renderVideoScript(data) {
        const directorNotes = document.getElementById('directorNotes');
        const scriptTimeline = document.getElementById('scriptTimeline');
        
        if (!directorNotes || !scriptTimeline) return;
        
        // Render Director's Notes
        directorNotes.innerHTML = `
            <div class="style-title">🎬 Director's Notes</div>
            <div class="style-row">
                <span class="style-tag">CONCEPT</span> ${data.director_notes.concept}
            </div>
            <div class="style-row">
                <span class="style-tag">STYLE</span> ${data.director_notes.style}
            </div>
            <div class="style-row">
                <span class="style-tag">TARGET</span> ${data.director_notes.target_audience}
            </div>
            <div class="style-row">
                <span class="style-tag">PLATFORM</span> ${data.director_notes.platform}
            </div>
            <div class="style-row">
                <span class="style-tag">DURATION</span> ${data.director_notes.duration}
            </div>
        `;
        
        // Render Scene Timeline
        scriptTimeline.innerHTML = '';
        data.scenes.forEach((scene, index) => {
            const sceneCard = document.createElement('div');
            sceneCard.className = 'script-scene-card';
            
            sceneCard.innerHTML = `
                <div class="scene-header">
                    <div class="scene-number">Scene ${index + 1}</div>
                    <div class="scene-timing">${scene.timing}</div>
                </div>
                <div class="scene-content">
                    <div class="scene-details">
                        <div class="detail-item">
                            <div class="detail-label">Camera</div>
                            <div class="detail-value">${scene.camera_angle}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Lighting</div>
                            <div class="detail-value">${scene.lighting}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Costume</div>
                            <div class="detail-value">${scene.costume}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Location</div>
                            <div class="detail-value">${scene.location}</div>
                        </div>
                    </div>
                    <div class="scene-description">
                        <strong>Scene Description:</strong> ${scene.description}
                    </div>
                    <button class="copy-script-btn" data-scene="${index + 1}">
                        📋 Copy Scene ${index + 1} Script
                    </button>
                </div>
            `;
            
            // Add copy functionality
            const copyBtn = sceneCard.querySelector('.copy-script-btn');
            copyBtn.addEventListener('click', () => {
                const sceneText = `Scene ${index + 1} (${scene.timing}):\n\nCamera: ${scene.camera_angle}\nLighting: ${scene.lighting}\nCostume: ${scene.costume}\nLocation: ${scene.location}\n\nDescription: ${scene.description}`;
                
                navigator.clipboard.writeText(sceneText).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '✅ Copied!';
                    copyBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.background = '';
                    }, 2000);
                });
            });
            
            scriptTimeline.appendChild(sceneCard);
        });
        
        // Add copy all script button
        const copyAllScriptBtn = document.createElement('button');
        copyAllScriptBtn.className = 'copy-script-btn';
        copyAllScriptBtn.style.marginTop = '20px';
        copyAllScriptBtn.innerHTML = '📋 Copy Complete Script';
        copyAllScriptBtn.addEventListener('click', () => {
            let fullScript = `Director's Notes:\nConcept: ${data.director_notes.concept}\nStyle: ${data.director_notes.style}\nTarget Audience: ${data.director_notes.target_audience}\nPlatform: ${data.director_notes.platform}\nDuration: ${data.director_notes.duration}\n\n`;
            
            data.scenes.forEach((scene, index) => {
                fullScript += `Scene ${index + 1} (${scene.timing}):\nCamera: ${scene.camera_angle}\nLighting: ${scene.lighting}\nCostume: ${scene.costume}\nLocation: ${scene.location}\nDescription: ${scene.description}\n\n`;
            });
            
            navigator.clipboard.writeText(fullScript).then(() => {
                const originalHTML = copyAllScriptBtn.innerHTML;
                copyAllScriptBtn.innerHTML = '✅ Complete Script Copied!';
                copyAllScriptBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                
                setTimeout(() => {
                    copyAllScriptBtn.innerHTML = originalHTML;
                    copyAllScriptBtn.style.background = '';
                }, 2000);
            });
        });
        
        scriptTimeline.appendChild(copyAllScriptBtn);
    }

    function formatCompactNumber(number) {
        return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(number);
    }

    function showError(msg) {
        resultsArea.innerHTML = `<div class="empty-state glass-panel" style="color:var(--primary-100)">⚠️ ${msg}</div>`;
    }
});