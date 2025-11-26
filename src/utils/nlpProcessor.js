const stopWords = new Set([
  '영상', '동영상', 'shorts', 'youtube', 'channel', 'video', '공식', '티저', 
  '뮤비', '직캠', '예고', '하이라이트', '모음', '반응', '댓글', '오늘', '내일', 
  '어제', '진짜', '정말', '너무', '다시', '보기', 'full', 'ver', 'sub', 'eng', 
  'kr', 'official', 'music', 'trailer', 'teaser', 'highlight', 'compilation'
]);

class NlpProcessor {
  constructor() {
    this.tokenizerRegex = /[가-힣a-zA-Z0-9]+/g;
  }

  extractKeywords(videos, limit = 20) {
    const frequencyMap = new Map();

    videos.forEach(video => {
      const textSource = `${video.title} ${(video.tags || []).join(' ')}`;
      const tokens = textSource.match(this.tokenizerRegex) || [];

      tokens.forEach(token => {
        const word = token.toLowerCase();

        if (word.length < 2) return;
        if (stopWords.has(word)) return;
        if (/^\d+$/.test(word)) return;

        frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
      });
    });

    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([text, weight]) => ({ text, weight }));
  }
}

module.exports = new NlpProcessor();
