import { z } from 'zod';

const wrapped = <T extends z.ZodTypeAny>(schema: T) => z.object({
  success: z.literal(true),
  response: schema,
});

export const AgentAuthInitSchema = wrapped(z.object({
  publicIdentifier: z.string().uuid(),
  secret: z.string().min(1),
  agentUsername: z.string().min(1),
  agentUserId: z.string().min(1),
  verificationPostContent: z.string().min(1),
}));

export const AgentAuthLoginSchema = wrapped(z.object({
  token: z.string().min(1),
}));

export const AgentWalletListSchema = wrapped(z.array(z.string().min(1)));

export const AgentWalletExportSchema = wrapped(z.object({
  privateKey: z.string().min(1),
}));

function extractFirstIssue(error: z.ZodError, label: string): Error {
  const issue = error.issues[0];
  const path = issue?.path.length ? issue.path.join('.') : 'root';
  return new Error(`Invalid Bags agent response for ${label}: ${path} ${issue?.message ?? 'schema validation failed'}`.trim());
}

export function parseAgentAuthInit(payload: unknown) {
  const result = AgentAuthInitSchema.safeParse(payload);
  if (!result.success) {
    throw extractFirstIssue(result.error, 'auth init');
  }
  return result.data.response;
}

export function parseAgentAuthLogin(payload: unknown) {
  const result = AgentAuthLoginSchema.safeParse(payload);
  if (!result.success) {
    throw extractFirstIssue(result.error, 'auth login');
  }
  return result.data.response;
}

export function parseAgentWalletList(payload: unknown) {
  const result = AgentWalletListSchema.safeParse(payload);
  if (!result.success) {
    throw extractFirstIssue(result.error, 'wallet list');
  }
  return result.data.response;
}

export function parseAgentWalletExport(payload: unknown) {
  const result = AgentWalletExportSchema.safeParse(payload);
  if (!result.success) {
    throw extractFirstIssue(result.error, 'wallet export');
  }
  return result.data.response;
}
