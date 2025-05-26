import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import type { LanguageModelConfig } from '@src/types/config.js';

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function createModuleErrorHandler(
  moduleName: string,
): (error: unknown) => never {
  return (error: unknown) => {
    if (getErrorCode(error) === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        `${moduleName} is not installed. Please install it with: npm install ${moduleName}`,
      );
    }
    throw error;
  };
}

export async function getLanguageChatModel(
  config: LanguageModelConfig,
): Promise<BaseChatModel> {
  const { provider, model } = config;

  switch (provider) {
    case 'anthropic': {
      const { ChatAnthropic } = await import('@langchain/anthropic').catch(
        createModuleErrorHandler('@langchain/anthropic'),
      );
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY environment variable is required for Anthropic provider',
        );
      }
      return new ChatAnthropic({
        apiKey,
        model: model ?? 'claude-sonnet-4-20250514',
      });
    }
    case 'google': {
      const { ChatGoogleGenerativeAI } = await import(
        '@langchain/google-genai'
      ).catch(createModuleErrorHandler('@langchain/google-genai'));
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error(
          'GOOGLE_API_KEY environment variable is required for Google provider',
        );
      }
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: model ?? 'gemini-2.0-flash',
      });
    }
    case 'openai': {
      const { ChatOpenAI } = await import('@langchain/openai').catch(
        createModuleErrorHandler('@langchain/openai'),
      );
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OPENAI_API_KEY environment variable is required for OpenAI provider',
        );
      }
      return new ChatOpenAI({
        apiKey,
        model: model ?? 'gpt-4.1-2025-04-14',
      });
    }
    default: {
      throw new Error(`Unknown Language Model Provider: ${provider as string}`);
    }
  }
}

export async function getLanguageEmbeddingsModel(
  config: LanguageModelConfig,
): Promise<EmbeddingsInterface> {
  const { embeddingsProvider, provider, model } = config;

  switch (embeddingsProvider ?? provider) {
    case 'openai': {
      const { OpenAIEmbeddings } = await import('@langchain/openai').catch(
        createModuleErrorHandler('@langchain/openai'),
      );
      return new OpenAIEmbeddings({
        model: model ?? 'text-embedding-3-small',
      });
    }
    case 'google': {
      const { GoogleGenerativeAIEmbeddings } = await import(
        '@langchain/google-genai'
      ).catch(createModuleErrorHandler('@langchain/google-genai'));
      return new GoogleGenerativeAIEmbeddings({
        model: model ?? 'gemini-2.0-flash',
      });
    }
    case 'anthropic': {
      throw new Error('Anthropic does not support embeddings');
    }
    default: {
      throw new Error(`Unknown Language Model Provider: ${provider as string}`);
    }
  }
}
