import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { AppError } from '@/lib/errors';
import {
  createRequestTool,
  createRequestInputSchema,
  createRequestHandler,
} from './tools/create_request';
import {
  listRequestsTool,
  listRequestsInputSchema,
  listRequestsHandler,
} from './tools/list_requests';
import {
  getResponseTool,
  getResponseInputSchema,
  getResponseHandler,
} from './tools/get_response';
import {
  peekResponseTool,
  peekResponseInputSchema,
  peekResponseHandler,
} from './tools/peek_response';
import {
  cancelRequestTool,
  cancelRequestInputSchema,
  cancelRequestHandler,
} from './tools/cancel_request';

export interface BuildMcpServerOpts {
  db: DB | TestDB;
  user: User;
  publicBaseUrl: string;
}

const TOOLS = [
  createRequestTool,
  listRequestsTool,
  getResponseTool,
  peekResponseTool,
  cancelRequestTool,
];

export function buildMcpServer({ db, user, publicBaseUrl }: BuildMcpServerOpts) {
  const server = new Server(
    { name: 'loop', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: 'object' as const, additionalProperties: true },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const text = await dispatch(name, args ?? {});
      return { content: [{ type: 'text' as const, text }] };
    } catch (err) {
      const payload =
        err instanceof AppError
          ? err.toJSON()
          : { error: { code: 'internal', message: String(err) } };
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }
  });

  async function dispatch(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'create_request': {
        const p = createRequestInputSchema.parse(args);
        return JSON.stringify(await createRequestHandler(db, user, publicBaseUrl, p));
      }
      case 'list_requests': {
        const p = listRequestsInputSchema.parse(args);
        return JSON.stringify(await listRequestsHandler(db, user, p));
      }
      case 'get_response': {
        const p = getResponseInputSchema.parse(args);
        return JSON.stringify(await getResponseHandler(db, user, p));
      }
      case 'peek_response': {
        const p = peekResponseInputSchema.parse(args);
        return JSON.stringify(await peekResponseHandler(db, user, p));
      }
      case 'cancel_request': {
        const p = cancelRequestInputSchema.parse(args);
        return JSON.stringify(await cancelRequestHandler(db, user, p));
      }
      default:
        throw new AppError('not_found', `Unknown tool: ${name}`, 404);
    }
  }

  return server;
}
