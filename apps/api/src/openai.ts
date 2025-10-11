import {
  fetchOpenAIDebugDetails,
  getOpenAIClient,
  isOpenAIDebugEnabled,
  type OpenAIClientConfig,
} from '@avocat-ai/shared';
import { env } from './config.js';

const defaultConfig: OpenAIClientConfig = {
  apiKey: env.OPENAI_API_KEY,
  cacheKeySuffix: 'api-backend',
  requestTags: process.env.OPENAI_REQUEST_TAGS_API ?? process.env.OPENAI_REQUEST_TAGS ?? 'service=api,component=backend',
};

export function getOpenAI() {
  return getOpenAIClient(defaultConfig);
}

type Logger = {
  error: (data: Record<string, unknown>, message: string) => void;
  warn?: (data: Record<string, unknown>, message: string) => void;
};

let defaultLogger: Logger | null = null;

export function setOpenAILogger(logger: Logger): void {
  defaultLogger = logger;
}

export async function logOpenAIDebug(
  operation: string,
  error: unknown,
  logger?: Logger,
): Promise<void> {
  if (!isOpenAIDebugEnabled()) {
    return;
  }

  const client = getOpenAI();
  const info = await fetchOpenAIDebugDetails(client, error);
  if (!info) {
    return;
  }

  const payload: Record<string, unknown> = {
    openaiRequestId: info.requestId,
  };

  if ('details' in info) {
    payload.debug = info.details;
  } else if ('debugError' in info) {
    payload.debugError = info.debugError instanceof Error ? info.debugError.message : info.debugError;
  }

  const targetLogger = logger ?? defaultLogger;
  if (targetLogger?.error) {
    targetLogger.error(payload, `${operation}_openai_debug`);
  } else {
    console.error(`[openai-debug] ${operation}`, payload);
  }
}
