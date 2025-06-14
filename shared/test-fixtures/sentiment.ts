/**
 * Shared Test Fixtures - Sentiment Analysis
 * 
 * Mock data and test fixtures for sentiment analysis testing across all packages
 */

import { SentimentResult, SentimentOptions, EmotionScores } from '../contracts/api';

// =============================================================================
// Sample Sentiment Results
// =============================================================================

export const POSITIVE_SENTIMENT_RESULT: SentimentResult = {
  id: 'sent_test_001',
  text: 'I absolutely love this product! It exceeded all my expectations.',
  sentiment: 'positive',
  confidence: 0.95,
  score: 0.8,
  keywords: ['love', 'exceeded', 'expectations'],
  emotions: {
    joy: 0.85,
    sadness: 0.02,
    anger: 0.01,
    fear: 0.01,
    surprise: 0.08,
    disgust: 0.03
  },
  processingTime: 120,
  createdAt: '2024-01-14T10:00:00Z'
};

export const NEGATIVE_SENTIMENT_RESULT: SentimentResult = {
  id: 'sent_test_002',
  text: 'This is terrible quality. I want my money back immediately!',
  sentiment: 'negative',
  confidence: 0.92,
  score: -0.7,
  keywords: ['terrible', 'money back', 'immediately'],
  emotions: {
    joy: 0.01,
    sadness: 0.15,
    anger: 0.75,
    fear: 0.05,
    surprise: 0.02,
    disgust: 0.02
  },
  processingTime: 95,
  createdAt: '2024-01-14T10:01:00Z'
};

export const NEUTRAL_SENTIMENT_RESULT: SentimentResult = {
  id: 'sent_test_003',
  text: 'The product arrived on time and matches the description.',
  sentiment: 'neutral',
  confidence: 0.88,
  score: 0.1,
  keywords: ['arrived', 'time', 'matches', 'description'],
  emotions: {
    joy: 0.15,
    sadness: 0.10,
    anger: 0.05,
    fear: 0.05,
    surprise: 0.10,
    disgust: 0.05
  },
  processingTime: 105,
  createdAt: '2024-01-14T10:02:00Z'
};

export const LOW_CONFIDENCE_RESULT: SentimentResult = {
  id: 'sent_test_004',
  text: 'It is what it is, I suppose.',
  sentiment: 'neutral',
  confidence: 0.45,
  score: 0.05,
  keywords: ['suppose'],
  emotions: {
    joy: 0.20,
    sadness: 0.20,
    anger: 0.15,
    fear: 0.15,
    surprise: 0.15,
    disgust: 0.15
  },
  processingTime: 85,
  createdAt: '2024-01-14T10:03:00Z'
};

// =============================================================================
// Test Text Samples
// =============================================================================

export const SAMPLE_TEXTS = {
  positive: [
    'I absolutely love this product! It exceeded all my expectations.',
    'Outstanding quality and fast shipping. Highly recommend!',
    'Best purchase I\'ve made this year. Five stars!',
    'Amazing customer service. They went above and beyond.',
    'Perfect! Exactly what I was looking for.',
    'Incredible value for money. Will definitely buy again.',
    'Fantastic product. Works perfectly as advertised.',
    'Delighted with this purchase. Thank you!',
    'Superb quality and attention to detail.',
    'Exceeded my expectations in every way possible.'
  ],
  negative: [
    'This is terrible quality. I want my money back immediately!',
    'Worst product ever. Complete waste of money.',
    'Broken on arrival. Very disappointed.',
    'Poor customer service. No response to my complaints.',
    'Overpriced and underdelivered. Avoid at all costs.',
    'Cheap materials, fell apart after one day.',
    'False advertising. Nothing like the description.',
    'Horrible experience. Would not recommend.',
    'Defective product. Requesting full refund.',
    'Completely useless. Total disappointment.'
  ],
  neutral: [
    'The product arrived on time and matches the description.',
    'It works as expected. Nothing special to report.',
    'Average quality for the price point.',
    'Standard shipping, product as described.',
    'Meets basic requirements. No complaints.',
    'Functional but not remarkable.',
    'Does what it says on the package.',
    'Acceptable quality for the cost.',
    'No issues with the order or delivery.',
    'Product performs adequately.'
  ],
  mixed: [
    'Great design but poor build quality.',
    'Fast shipping but product was damaged.',
    'Love the features but hate the price.',
    'Good customer service, mediocre product.',
    'Beautiful packaging, disappointing contents.',
    'Works well but instructions are unclear.',
    'High quality materials, confusing interface.',
    'Perfect size but wrong color sent.',
    'Excellent idea, poor execution.',
    'Great concept, needs improvement.'
  ],
  ambiguous: [
    'It is what it is, I suppose.',
    'Could be better, could be worse.',
    'Not sure how I feel about this.',
    'Interesting product.',
    'Well, that happened.',
    'I have mixed feelings.',
    'It\'s fine, I guess.',
    'Different from what I expected.',
    'Not what I thought it would be.',
    'Hard to say if it\'s good or bad.'
  ]
};

// =============================================================================
// Batch Processing Fixtures
// =============================================================================

export const SAMPLE_BATCH_RESULTS: SentimentResult[] = [
  POSITIVE_SENTIMENT_RESULT,
  NEGATIVE_SENTIMENT_RESULT,
  NEUTRAL_SENTIMENT_RESULT,
  {
    id: 'sent_batch_001',
    text: 'Great design but poor build quality.',
    sentiment: 'neutral',
    confidence: 0.72,
    score: 0.05,
    keywords: ['great', 'design', 'poor', 'quality'],
    emotions: {
      joy: 0.35,
      sadness: 0.25,
      anger: 0.15,
      fear: 0.05,
      surprise: 0.10,
      disgust: 0.10
    },
    processingTime: 110,
    createdAt: '2024-01-14T10:04:00Z'
  },
  {
    id: 'sent_batch_002',
    text: 'Outstanding quality and fast shipping.',
    sentiment: 'positive',
    confidence: 0.96,
    score: 0.85,
    keywords: ['outstanding', 'quality', 'fast', 'shipping'],
    emotions: {
      joy: 0.80,
      sadness: 0.02,
      anger: 0.01,
      fear: 0.02,
      surprise: 0.12,
      disgust: 0.03
    },
    processingTime: 98,
    createdAt: '2024-01-14T10:05:00Z'
  }
];

// =============================================================================
// Statistics Fixtures
// =============================================================================

export const SAMPLE_SENTIMENT_STATISTICS = {
  totalAnalyses: 1250,
  todayAnalyses: 47,
  averageScore: 0.15,
  distribution: {
    positive: 520,
    negative: 380,
    neutral: 350
  },
  trendsLast7Days: [
    { date: '2024-01-14', count: 47, averageScore: 0.22 },
    { date: '2024-01-13', count: 62, averageScore: 0.18 },
    { date: '2024-01-12', count: 38, averageScore: 0.09 },
    { date: '2024-01-11', count: 51, averageScore: 0.31 },
    { date: '2024-01-10', count: 44, averageScore: 0.12 },
    { date: '2024-01-09', count: 55, averageScore: 0.25 },
    { date: '2024-01-08', count: 49, averageScore: 0.17 }
  ],
  topKeywords: [
    { keyword: 'great', frequency: 125, averageScore: 0.72 },
    { keyword: 'love', frequency: 98, averageScore: 0.89 },
    { keyword: 'quality', frequency: 87, averageScore: 0.15 },
    { keyword: 'terrible', frequency: 76, averageScore: -0.85 },
    { keyword: 'excellent', frequency: 72, averageScore: 0.91 },
    { keyword: 'disappointed', frequency: 65, averageScore: -0.68 },
    { keyword: 'recommend', frequency: 58, averageScore: 0.78 },
    { keyword: 'waste', frequency: 52, averageScore: -0.92 },
    { keyword: 'perfect', frequency: 48, averageScore: 0.95 },
    { keyword: 'broken', frequency: 44, averageScore: -0.88 }
  ]
};

// =============================================================================
// Configuration Fixtures
// =============================================================================

export const DEFAULT_SENTIMENT_OPTIONS: SentimentOptions = {
  includeKeywords: true,
  includeEmotions: true,
  language: 'en',
  model: 'basic'
};

export const ADVANCED_SENTIMENT_OPTIONS: SentimentOptions = {
  includeKeywords: true,
  includeEmotions: true,
  language: 'en',
  model: 'advanced'
};

export const MINIMAL_SENTIMENT_OPTIONS: SentimentOptions = {
  includeKeywords: false,
  includeEmotions: false,
  language: 'en',
  model: 'basic'
};

// =============================================================================
// Performance Test Data
// =============================================================================

export const PERFORMANCE_TEST_TEXTS = {
  short: Array.from({ length: 100 }, (_, i) => 
    `Short text ${i + 1} for testing performance with minimal content.`
  ),
  medium: Array.from({ length: 50 }, (_, i) => 
    `This is a medium-length text sample number ${i + 1} that contains enough content to test sentiment analysis performance with more substantial input while still being manageable for batch processing operations.`
  ),
  long: Array.from({ length: 10 }, (_, i) => 
    `This is a very long text sample number ${i + 1} that contains extensive content designed to test sentiment analysis performance with substantial input data. It includes multiple sentences, various sentiment indicators, and complex language structures that might challenge the analysis algorithms. The purpose is to ensure that the system can handle longer texts efficiently while maintaining accuracy in sentiment detection and classification. This type of content is representative of real-world scenarios where users might submit lengthy reviews, feedback, or comments for analysis.`
  ),
  extreme: Array.from({ length: 5 }, (_, i) => 
    Array.from({ length: 50 }, () => 
      `Extremely long text sample ${i + 1} with repeated content to test system limits.`
    ).join(' ')
  )
};

// =============================================================================
// Error Case Fixtures
// =============================================================================

export const ERROR_CASES = {
  emptyText: '',
  whitespaceOnly: '   \t\n   ',
  specialCharacters: '!@#$%^&*(){}[]|\\:";\'<>?,./~`',
  unicodeText: '🎉 Great product! 😍 Love it! 👍',
  veryLongText: 'A'.repeat(10000),
  htmlContent: '<div>This is <strong>HTML</strong> content that should be handled properly.</div>',
  jsonContent: '{"review": "This is JSON content", "rating": 5}',
  mixedLanguages: 'This is English text mixed with 这是中文文本 and some العربية content.',
  codeContent: 'function test() { return "This is code content"; }',
  sqlInjection: "'; DROP TABLE reviews; --"
};

// =============================================================================
// Language Support Fixtures
// =============================================================================

export const MULTILINGUAL_SAMPLES = {
  english: 'This product is absolutely amazing!',
  spanish: '¡Este producto es absolutamente increíble!',
  french: 'Ce produit est absolument incroyable!',
  german: 'Dieses Produkt ist absolut erstaunlich!',
  chinese: '这个产品绝对令人惊叹！',
  japanese: 'この製品は絶対に素晴らしいです！',
  arabic: 'هذا المنتج مذهل تماماً!',
  russian: 'Этот продукт абсолютно потрясающий!',
  portuguese: 'Este produto é absolutamente incrível!',
  italian: 'Questo prodotto è assolutamente fantastico!'
};

// =============================================================================
// Export Collections
// =============================================================================

export const ALL_SENTIMENT_RESULTS = [
  POSITIVE_SENTIMENT_RESULT,
  NEGATIVE_SENTIMENT_RESULT,
  NEUTRAL_SENTIMENT_RESULT,
  LOW_CONFIDENCE_RESULT,
  ...SAMPLE_BATCH_RESULTS
];

export const ALL_TEST_TEXTS = [
  ...SAMPLE_TEXTS.positive,
  ...SAMPLE_TEXTS.negative,
  ...SAMPLE_TEXTS.neutral,
  ...SAMPLE_TEXTS.mixed,
  ...SAMPLE_TEXTS.ambiguous
];

export const SENTIMENT_TEST_SCENARIOS = {
  basic: {
    texts: SAMPLE_TEXTS.positive.slice(0, 3),
    options: DEFAULT_SENTIMENT_OPTIONS,
    expectedSentiment: 'positive'
  },
  batch: {
    texts: [
      ...SAMPLE_TEXTS.positive.slice(0, 2),
      ...SAMPLE_TEXTS.negative.slice(0, 2),
      ...SAMPLE_TEXTS.neutral.slice(0, 1)
    ],
    options: ADVANCED_SENTIMENT_OPTIONS,
    expectedDistribution: { positive: 2, negative: 2, neutral: 1 }
  },
  performance: {
    texts: PERFORMANCE_TEST_TEXTS.medium,
    options: MINIMAL_SENTIMENT_OPTIONS,
    maxProcessingTime: 5000 // 5 seconds
  },
  errorHandling: {
    texts: Object.values(ERROR_CASES),
    options: DEFAULT_SENTIMENT_OPTIONS,
    shouldHandle: true
  }
};