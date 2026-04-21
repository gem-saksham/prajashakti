/**
 * AI routes — /api/v1/ai/
 *
 * POST /draft   — Generate a draft issue description via Claude API
 *
 * Proxies to Anthropic API so the key is never exposed to the browser.
 * Requires auth so the endpoint can't be abused publicly.
 */

import { authenticate } from '../middleware/auth.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

export default async function aiRoutes(fastify) {
  /**
   * POST /api/v1/ai/draft
   * Body: { title, category, location: { district, state } }
   * Returns: { description }
   */
  fastify.post('/draft', {
    onRequest: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          category: { type: 'string', maxLength: 50 },
          district: { type: 'string', maxLength: 100 },
          state: { type: 'string', maxLength: 100 },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AI_UNAVAILABLE',
            message: 'AI features are not configured on this server.',
          },
        });
      }

      const { title, category, district, state } = request.body;
      const locationStr = [district, state].filter(Boolean).join(', ') || 'India';

      const prompt = `You are a civic helper for PrajaShakti, an Indian citizen advocacy platform.

A citizen wants to report a civic issue. Help them write a clear, factual, and actionable description.

Issue title: "${title}"
Category: ${category || 'General'}
Location: ${locationStr}

Write a 3-4 sentence description that:
1. Describes the problem clearly (what, where, how severe)
2. Mentions who is affected and how
3. States how long the problem has existed (use "for some time" if unknown)
4. Ends with what resolution is expected

Write in plain English. Be factual, not dramatic. Do not include any headings or bullet points. Output only the description text.`;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          fastify.log.warn({ status: response.status, err }, 'Anthropic API error');
          return reply.status(502).send({
            success: false,
            error: {
              code: 'AI_ERROR',
              message: 'AI service unavailable. Please write your own description.',
            },
          });
        }

        const data = await response.json();
        const description = data.content
          ?.map((b) => b.text || '')
          .join('')
          .trim();

        return reply.send({ success: true, data: { description } });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
