import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    label: text('label').notNull(),
    lastUsedAt: integer('last_used_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byHash: index('idx_api_tokens_hash').on(t.tokenHash),
  })
);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
});

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniqUserName: uniqueIndex('idx_projects_user_name').on(t.userId, t.name),
  })
);

export const requests = sqliteTable(
  'requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    token: text('token').notNull().unique(),
    slug: text('slug').notNull(),
    status: text('status').notNull(),
    title: text('title').notNull(),
    intro: text('intro'),
    context: text('context'),
    questions: text('questions').notNull(),
    draftAnswers: text('draft_answers'),
    finalAnswers: text('final_answers'),
    submittedAt: integer('submitted_at'),
    pulledAt: integer('pulled_at'),
    cancelledAt: integer('cancelled_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniqUserSlug: uniqueIndex('idx_requests_user_slug').on(t.userId, t.slug),
    byUserCreated: index('idx_requests_user_created').on(t.userId, t.createdAt),
    byToken: index('idx_requests_token').on(t.token),
  })
);

export type User = typeof users.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
