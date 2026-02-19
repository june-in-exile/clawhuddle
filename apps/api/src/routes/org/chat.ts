import { FastifyInstance } from 'fastify';
import { getOrgApiKey } from './api-keys.js';
import type { ChatMessage } from '@clawteam/shared';

export async function orgChatRoutes(app: FastifyInstance) {
  app.post<{ Params: { orgId: string }; Body: { messages: ChatMessage[] } }>(
    '/api/orgs/:orgId/chat',
    async (request, reply) => {
      const { messages } = request.body;
      const apiKey = getOrgApiKey(request.orgId!, 'anthropic');

      if (!apiKey) {
        return reply.status(503).send({
          error: 'no_api_key',
          message: 'No Anthropic API key configured. Ask your admin to set one up.',
        });
      }

      // Call Anthropic Messages API with streaming
      const anthropicMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          stream: true,
          messages: anthropicMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        app.log.error(`Anthropic error: ${err}`);
        return reply.status(502).send({ error: 'upstream', message: 'LLM request failed' });
      }

      // Stream SSE back to client as plain text chunks
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  reply.raw.write(parsed.delta.text);
                }
              } catch {
                // skip non-JSON lines
              }
            }
          }
        }
      }

      reply.raw.end();
    }
  );
}
