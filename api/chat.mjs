// AI chat proxy — keeps API key server-side. Routes to Anthropic via Azure AI
// Foundry; response is shaped like OpenAI Chat Completions so legacy callers
// don't notice the swap. POST { messages, tools?, model? } → streams chunks as SSE.

import { createAIClient } from '../lib/ai-client.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.AZURE_KEY) {
    res.status(500).json({ error: 'AZURE_KEY is not configured on the server' });
    return;
  }

  const { messages, tools, model } = req.body || {};

  if (!messages?.length) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const client = createAIClient();

  try {
    const params = { model, messages, stream: true };
    if (tools?.length) {
      params.tools = tools;
      params.tool_choice = 'auto';
    }

    const stream = await client.chat.completions.create(params);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}
