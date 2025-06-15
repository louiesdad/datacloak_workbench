// Web Worker for sentiment analysis processing without blocking the main thread

export interface SentimentAnalysisMessage {
  type: 'ANALYZE_BATCH' | 'ANALYZE_STREAM' | 'CANCEL_ANALYSIS';
  payload: any;
}

export interface SentimentAnalysisResult {
  type: 'ANALYSIS_COMPLETE' | 'ANALYSIS_ERROR' | 'PROGRESS_UPDATE' | 'BATCH_COMPLETE';
  payload: any;
}

interface SentimentScore {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keywords?: string[];
  emotions?: Record<string, number>;
}

// Simple sentiment analysis (in production, this would call the actual API)
const analyzeSentiment = (text: string): SentimentScore => {
  // Simplified sentiment analysis for demo
  const positiveWords = ['good', 'great', 'excellent', 'wonderful', 'amazing', 'fantastic', 'love', 'happy'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'angry', 'sad', 'disappointed'];
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let positiveCount = 0;
  let negativeCount = 0;
  const foundKeywords: string[] = [];
  
  words.forEach(word => {
    if (positiveWords.includes(word)) {
      positiveCount++;
      foundKeywords.push(word);
    }
    if (negativeWords.includes(word)) {
      negativeCount++;
      foundKeywords.push(word);
    }
  });
  
  const totalSentimentWords = positiveCount + negativeCount;
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  let confidence = 0.5;
  
  if (totalSentimentWords > 0) {
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      confidence = positiveCount / totalSentimentWords;
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      confidence = negativeCount / totalSentimentWords;
    }
  }
  
  // Mock emotions
  const emotions = {
    joy: sentiment === 'positive' ? confidence * 0.8 : 0.1,
    sadness: sentiment === 'negative' ? confidence * 0.7 : 0.1,
    anger: sentiment === 'negative' ? confidence * 0.3 : 0.05,
    fear: 0.1,
    surprise: 0.05
  };
  
  return {
    text: text.substring(0, 100), // Truncate for preview
    sentiment,
    confidence,
    keywords: foundKeywords.slice(0, 5),
    emotions
  };
};

// Process batch of texts
const processBatch = async (
  texts: string[],
  batchIndex: number,
  options: any,
  onProgress?: (progress: number) => void
): Promise<SentimentScore[]> => {
  const results: SentimentScore[] = [];
  const totalTexts = texts.length;
  
  for (let i = 0; i < texts.length; i++) {
    // Analyze sentiment
    const result = analyzeSentiment(texts[i]);
    results.push(result);
    
    // Report progress
    if (onProgress && i % 10 === 0) {
      const progress = Math.round(((i + 1) / totalTexts) * 100);
      onProgress(progress);
    }
    
    // Allow other tasks to run
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return results;
};

// Aggregate results
const aggregateResults = (results: SentimentScore[]) => {
  const summary = {
    total: results.length,
    positive: 0,
    negative: 0,
    neutral: 0,
    averageConfidence: 0,
    topKeywords: new Map<string, number>(),
    emotionAverages: {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0
    }
  };
  
  results.forEach(result => {
    summary[result.sentiment]++;
    summary.averageConfidence += result.confidence;
    
    // Aggregate keywords
    result.keywords?.forEach(keyword => {
      summary.topKeywords.set(keyword, (summary.topKeywords.get(keyword) || 0) + 1);
    });
    
    // Aggregate emotions
    if (result.emotions) {
      Object.entries(result.emotions).forEach(([emotion, score]) => {
        summary.emotionAverages[emotion as keyof typeof summary.emotionAverages] += score;
      });
    }
  });
  
  // Calculate averages
  summary.averageConfidence /= results.length;
  Object.keys(summary.emotionAverages).forEach(emotion => {
    summary.emotionAverages[emotion as keyof typeof summary.emotionAverages] /= results.length;
  });
  
  // Get top keywords
  const topKeywordsArray = Array.from(summary.topKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));
  
  return {
    ...summary,
    topKeywords: topKeywordsArray
  };
};

// Track cancellation
let isCancelled = false;

// Worker message handler
self.onmessage = async (event: MessageEvent<SentimentAnalysisMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'ANALYZE_BATCH': {
        isCancelled = false;
        const { texts, options } = payload;
        const batchSize = options?.batchSize || 100;
        const batches = Math.ceil(texts.length / batchSize);
        const results: SentimentScore[] = [];
        
        for (let i = 0; i < batches; i++) {
          if (isCancelled) {
            throw new Error('Analysis cancelled');
          }
          
          const start = i * batchSize;
          const end = Math.min(start + batchSize, texts.length);
          const batchTexts = texts.slice(start, end);
          
          const batchResults = await processBatch(
            batchTexts,
            i,
            options,
            (batchProgress) => {
              const overallProgress = Math.round(((i * batchSize + (batchProgress / 100) * batchTexts.length) / texts.length) * 100);
              postMessage({
                type: 'PROGRESS_UPDATE',
                payload: {
                  progress: overallProgress,
                  processedCount: start + Math.round((batchProgress / 100) * batchTexts.length),
                  totalCount: texts.length,
                  currentBatch: i + 1,
                  totalBatches: batches
                }
              } as SentimentAnalysisResult);
            }
          );
          
          results.push(...batchResults);
          
          // Send batch complete
          postMessage({
            type: 'BATCH_COMPLETE',
            payload: {
              batchIndex: i,
              batchResults: batchResults.length,
              totalProcessed: results.length
            }
          } as SentimentAnalysisResult);
        }
        
        // Aggregate results
        const summary = aggregateResults(results);
        
        postMessage({
          type: 'ANALYSIS_COMPLETE',
          payload: {
            results,
            summary,
            processingTime: Date.now() - startTime
          }
        } as SentimentAnalysisResult);
        break;
      }
      
      case 'CANCEL_ANALYSIS': {
        isCancelled = true;
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'ANALYSIS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
        type
      }
    } as SentimentAnalysisResult);
  }
};

// Track start time for performance metrics
const startTime = Date.now();

export {};