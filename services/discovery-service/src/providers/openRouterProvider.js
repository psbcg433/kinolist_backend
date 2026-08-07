import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * OpenRouter chat completion. Returns the assistant text or `null` on any
 * failure (callers fall back to simple behaviour, mirroring legacy semantics).
 */
export async function askOpenRouter(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.openRouter.timeoutMs);

  let response;
  try {
    response = await fetch(config.openRouter.baseUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.openRouter.apiKey}`,
        'content-type': 'application/json',
        'x-title': 'kinolist-discovery',
      },
      body: JSON.stringify({
        model: config.openRouter.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    logger.warn('openrouter_request_failed', { timedOut, message: err.message });
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    logger.warn('openrouter_http_error', { status: response.status });
    return null;
  }

  try {
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch (err) {
    logger.warn('openrouter_parse_failed', { message: err.message });
    return null;
  }
}
