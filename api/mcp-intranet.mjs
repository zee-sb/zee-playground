// Acme Intranet — MCP Server (RAG demo)
// Exposes the intranet content corpus (leadership memos, product updates,
// team wikis, events, ERG pages, employee spotlights) to the Navigator
// orchestrator. Keyword search only — no embeddings — but presents the same
// "search → ground answer in retrieved passages" pattern Navigator uses for
// any RAG knowledge source.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import {
  INTRANET_ARTICLES,
  CATEGORIES,
  CATEGORY_LABELS,
  searchArticles,
  getArticle,
  listArticles,
} from './data/intranet-articles.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
};

// ── Build MCP server ──────────────────────────────────────────────────────────

function buildServer() {
  const server = new McpServer({
    name: 'acme-intranet',
    version: '1.0.0',
  });

  // ── Resources ──────────────────────────────────────────────────────────────

  // Index — gives the LLM a snapshot of every available article (no body).
  server.resource(
    'intranet-index',
    'acme://intranet',
    { description: 'Index of all Acme intranet articles (id, title, category, author, date)', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'acme://intranet',
        mimeType: 'application/json',
        text: JSON.stringify(listArticles(), null, 2),
      }],
    })
  );

  // One static resource per article.
  for (const article of INTRANET_ARTICLES) {
    server.resource(
      `intranet-${article.id}`,
      `acme://intranet/${article.id}`,
      {
        description: `${article.title} — ${CATEGORY_LABELS[article.category] || article.category} (${article.publishedAt})`,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [{
          uri: `acme://intranet/${article.id}`,
          mimeType: 'text/markdown',
          text: article.body,
        }],
      })
    );
  }

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.tool(
    'search_articles',
    'Keyword search across the Acme intranet (leadership memos, product updates, team wikis, events, ERG pages, employee spotlights). Returns the top matching articles with title, summary, author, and date.',
    {
      query: z.string().describe('Search keywords (e.g. "Q2 priorities", "self-serve launch", "pride month", "engineering on-call")'),
      category: z.enum(CATEGORIES).optional().describe('Optional category filter: leadership, product, team_wiki, event, erg, spotlight'),
    },
    async ({ query, category }) => {
      const results = searchArticles(query, category);
      return {
        content: [{
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : `No intranet articles found matching "${query}"${category ? ` in category "${category}"` : ''}. Try broader terms or use list_recent.`,
        }],
      };
    }
  );

  server.tool(
    'get_article',
    'Fetch the full body of a single intranet article by id.',
    {
      article_id: z.string().describe('Article id, e.g. "ceo-q2-priorities", "self-serve-onboarding-launch"'),
    },
    async ({ article_id }) => {
      const article = getArticle(article_id);
      if (!article) {
        return {
          content: [{ type: 'text', text: `Article "${article_id}" not found. Use search_articles to find available article ids.` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text', text: JSON.stringify(article, null, 2) }] };
    }
  );

  server.tool(
    'list_recent',
    'List the most recently published intranet articles, optionally filtered by category. Use this when the user asks "what\'s new" or wants to browse rather than search.',
    {
      category: z.enum(CATEGORIES).optional().describe('Optional category filter: leadership, product, team_wiki, event, erg, spotlight'),
      limit:    z.number().int().min(1).max(15).optional().describe('Max number of articles to return (default 6)'),
    },
    async ({ category, limit }) => {
      const results = listArticles({ category, limit: limit || 6 });
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ── Prompts ────────────────────────────────────────────────────────────────

  server.prompt(
    'navigator_ui',
    'Response formatting and UX guidelines for the Navigator orchestrator',
    [],
    async () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `## Acme Intranet — Navigator UI Guidelines

When grounding an answer in intranet content, format for a mobile chat interface.

**Search results**
Lead with a one-sentence direct answer to the user's question (synthesised from the matching articles). Then cite up to 3 sources, one per line, in this shape:
- **[Article title]** — [author], [date]
- short one-line summary

**Single article**
If the user asks "show me the [Title]" or follows up on a search hit, lead with the title in bold, the author and date on the next line, then 3-5 bullet points pulled from the article body. End with "Read full article at acme://intranet/[id]".

**What's new / browsing**
For "what's new" / "anything from leadership lately?" / "any recent product updates?", call \`list_recent\` (with the matching category if obvious). Format as a short bulleted list: title, one-sentence summary, date.

**Categories** (use the labels, not the raw keys): Leadership, Product, Team Wiki, Events, ERGs & Culture, Employee Spotlight.

**Do**
- Quote sparingly — one short phrase if it matters, never paragraph dumps.
- When summarising leadership memos, preserve the leader's voice ("the CEO is asking us to focus on…").
- Surface the date when it matters ("From last week's all-hands recap…").

**Don't**
- Don't invent facts not in the retrieved articles.
- Don't summarise an article you didn't retrieve.
- Don't show the raw article id unless the user specifically asks.

**After completing an intranet answer**, suggest 2-3 of:
- "Show me the full article"
- "What other [category] updates are recent?"
- "Find articles about [related topic mentioned]"
- "List the latest leadership posts"`,
        },
      }],
    })
  );

  return server;
}

// ── Vercel handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const server = buildServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode for serverless
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close();
  }
}
