import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock OpenAI response generators
const generateChatCompletion = (prompt: string) => {
  // Simple sentiment analysis based on keywords
  const positiveKeywords = ['love', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
  const negativeKeywords = ['hate', 'terrible', 'awful', 'horrible', 'bad', 'worst'];
  
  const text = prompt.toLowerCase();
  let sentiment = 'neutral';
  let confidence = 0.7;

  if (positiveKeywords.some(word => text.includes(word))) {
    sentiment = 'positive';
    confidence = 0.85 + Math.random() * 0.15;
  } else if (negativeKeywords.some(word => text.includes(word))) {
    sentiment = 'negative';
    confidence = 0.80 + Math.random() * 0.20;
  } else {
    confidence = 0.60 + Math.random() * 0.30;
  }

  return {
    sentiment,
    confidence: Math.round(confidence * 100) / 100,
    reasoning: `Detected ${sentiment} sentiment based on language patterns and keyword analysis.`
  };
};

// OpenAI API mock handlers
export const openaiHandlers = [
  // Chat completions endpoint
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    const { messages, model } = body;

    // Extract the text to analyze from the last message
    const lastMessage = messages[messages.length - 1];
    const textToAnalyze = lastMessage?.content || '';

    // Generate mock sentiment analysis
    const analysis = generateChatCompletion(textToAnalyze);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    return HttpResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify(analysis)
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: textToAnalyze.length / 4, // Rough token estimation
        completion_tokens: 50,
        total_tokens: (textToAnalyze.length / 4) + 50
      }
    });
  }),

  // Embeddings endpoint (if used for similarity analysis)
  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json() as any;
    const { input } = body;

    // Generate mock embeddings (normally 1536 dimensions for text-embedding-ada-002)
    const embeddings = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

    await new Promise(resolve => setTimeout(resolve, 100));

    return HttpResponse.json({
      object: 'list',
      data: [
        {
          object: 'embedding',
          embedding: embeddings,
          index: 0
        }
      ],
      model: 'text-embedding-ada-002',
      usage: {
        prompt_tokens: Array.isArray(input) ? input.join(' ').length / 4 : input.length / 4,
        total_tokens: Array.isArray(input) ? input.join(' ').length / 4 : input.length / 4
      }
    });
  }),

  // Models endpoint
  http.get('https://api.openai.com/v1/models', () => {
    return HttpResponse.json({
      object: 'list',
      data: [
        {
          id: 'gpt-3.5-turbo',
          object: 'model',
          created: 1677610602,
          owned_by: 'openai'
        },
        {
          id: 'gpt-4',
          object: 'model',
          created: 1687882411,
          owned_by: 'openai'
        },
        {
          id: 'text-embedding-ada-002',
          object: 'model',
          created: 1671217299,
          owned_by: 'openai-internal'
        }
      ]
    });
  }),

  // Error simulation
  http.post('https://api.openai.com/v1/simulate-rate-limit', () => {
    return HttpResponse.json(
      {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_exceeded',
          code: 'rate_limit_exceeded'
        }
      },
      { status: 429 }
    );
  }),

  http.post('https://api.openai.com/v1/simulate-auth-error', () => {
    return HttpResponse.json(
      {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      },
      { status: 401 }
    );
  })
];

export const createOpenAIMockServer = () => {
  return setupServer(...openaiHandlers);
};