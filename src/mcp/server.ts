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

export interface BuildMcpServerOpts {
  db: DB | TestDB;
  user: User;
  publicBaseUrl: string;
}

export function buildMcpServer({ db, user, publicBaseUrl }: BuildMcpServerOpts) {
  const server = new Server(
    { name: 'loop', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: createRequestTool.name,
        description: createRequestTool.description,
        inputSchema: { type: 'object' as const, additionalProperties: true },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      if (name === 'create_request') {
        const parsed = createRequestInputSchema.parse(args ?? {});
        const result = await createRequestHandler(db, user, publicBaseUrl, parsed);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      }
      throw new AppError('not_found', `Unknown tool: ${name}`, 404);
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

  return server;
}
