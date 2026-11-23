import { createHash } from 'node:crypto';
import { aiCacheRepository } from '../../db/repositories/aiCache.repository.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { getConfig } from '../../lib/config.js';
import { serviceUnavailable, unprocessable } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { CATEGORY_LABELS, type Category } from '../../lib/types.js';
import { buildUserPrompt, SYSTEM_PROMPT } from './ai.prompt.js';

export type EffectiveProvider = 'openai' | 'gemini' | 'local' | 'local-fallback';

export interface OptimizeResult {
  optimizedText: string;
  provider: EffectiveProvider;
  cached: boolean;
}

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbug\s*-?\s*fix(es|ing|ed)?\b/gi, 'Fehlerbehebung'],
  [/\bbugs?\b/gi, 'Fehler'],
  [/\bgefix(t|ed)?\b/gi, 'behoben'],
  [/\bgemacht\b/gi, 'durchgeführt'],
  [/\bgetan\b/gi, 'durchgeführt'],
  [/\bgeguckt\b/gi, 'geprüft'],
  [/\bgeschaut\b/gi, 'geprüft'],
  [/\bzeug\b/gi, 'Material'],
  [/\bkram\b/gi, 'Komponenten'],
  [/\bsachen\b/gi, 'Aufgaben'],
  [/\bapi\b/gi, 'REST-API'],
  [/\bpc\b/gi, 'Rechner'],
  [/\bheute\b/gi, ''],
  [/\bund dann\b/gi, 'anschließend'],
  [/\bbisschen\b/gi, 'geringfügig'],
  [/\bok\b/gi, 'in Ordnung'],
];

/**
 * Deterministic offline fallback so the application stays fully functional
 * without an AI API key (demo mode, CI, local development).
 */
export function localOptimize(text: string, category: Category): string {
  let result = text.replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  result = result
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[,;:\s]+/, '')
    .trim();

  if (!result) return '';

  const sentences = result
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(' ');
  result = sentences;
  if (!/[.!?]$/.test(result)) result += '.';

  if (category === 'BERUFSSCHULE' && !/berufsschule/i.test(result)) {
    result = `Berufsschule: ${result}`;
  }
  return result;
}

function stripPreamble(text: string): string {
  return text
    .replace(
      /^(hier ist der optimierte text|hier ist die optimierte fassung|hier ist der optimierte|hier sind die optimierten texte|hier ist|hier sind|der optimierte text|optimierter text|optimierte fassung)\s*:?\s*/i,
      '',
    )
    .replace(/^["'„“]+|["'“”]+$/g, '')
    .trim();
}

export function postProcess(raw: string): { text: string; truncated: boolean } {
  const maxLength = getConfig().ai.maxOutputChars;
  let text = stripPreamble(raw).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  let truncated = false;

  if (text.length > maxLength) {
    const slice = text.slice(0, maxLength - 1);
    const lastSpace = slice.lastIndexOf(' ');
    text = `${(lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice).trim()}…`;
    truncated = true;
  }
  return { text, truncated };
}

function resolveProvider(): Exclude<EffectiveProvider, 'local-fallback'> {
  const { ai } = getConfig();
  if (ai.provider === 'local') return 'local';
  if (ai.provider === 'openai') return ai.openAiKey ? 'openai' : ai.geminiKey ? 'gemini' : 'local';
  return ai.geminiKey ? 'gemini' : ai.openAiKey ? 'openai' : 'local';
}

async function callOpenAi(input: {
  text: string;
  category: Category;
  profession?: string;
}): Promise<string> {
  const { ai } = getConfig();
  if (!ai.openAiKey) throw serviceUnavailable('OpenAI ist nicht konfiguriert.');

  const response = await fetch(`${ai.openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.openAiKey}`,
    },
    body: JSON.stringify({
      model: ai.openAiModel,
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserPrompt({
            text: input.text,
            category: input.category,
            profession: input.profession,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw serviceUnavailable(`OpenAI-Anfrage fehlgeschlagen (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw serviceUnavailable('OpenAI lieferte keine Antwort.');
  return content;
}

async function callGemini(input: {
  text: string;
  category: Category;
  profession?: string;
}): Promise<string> {
  const { ai } = getConfig();
  if (!ai.geminiKey) throw serviceUnavailable('Gemini ist nicht konfiguriert.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    ai.geminiModel,
  )}:generateContent?key=${encodeURIComponent(ai.geminiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildUserPrompt({
                text: input.text,
                category: input.category,
                profession: input.profession,
              }),
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw serviceUnavailable(`Gemini-Anfrage fehlgeschlagen (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!content) throw serviceUnavailable('Gemini lieferte keine Antwort.');
  return content;
}

export function buildCacheKey(input: {
  provider: string;
  text: string;
  category: Category;
  profession?: string;
}): string {
  return createHash('sha256')
    .update(
      [
        'azubitrack-ai-v1',
        input.provider,
        input.profession?.trim().toLowerCase() ?? '',
        input.category,
        input.text.trim(),
      ].join('\u0000'),
    )
    .digest('hex');
}

export async function optimizeText(input: {
  text: string;
  category: Category;
  profession?: string;
}): Promise<OptimizeResult> {
  const config = getConfig();
  const text = input.text.replace(/\s+/g, ' ').trim();

  if (text.length < 3) {
    throw unprocessable('Der Text ist zu kurz für eine Optimierung.');
  }
  if (text.length > config.ai.maxInputChars) {
    throw unprocessable(
      `Der Text darf höchstens ${config.ai.maxInputChars} Zeichen enthalten.`,
    );
  }

  const provider = resolveProvider();
  const cacheKey = buildCacheKey({ ...input, text, provider });

  const cached = (await cacheGet(cacheKey)) ?? (await aiCacheRepository.get(cacheKey));
  if (cached) {
    return { optimizedText: cached, provider, cached: true };
  }

  let raw: string;
  let effectiveProvider: EffectiveProvider = provider;
  try {
    if (provider === 'openai') {
      raw = await callOpenAi({ text, category: input.category, profession: input.profession });
    } else if (provider === 'gemini') {
      raw = await callGemini({ text, category: input.category, profession: input.profession });
    } else {
      raw = localOptimize(text, input.category);
    }
  } catch (error) {
    logger.warn({ err: error, provider }, 'AI provider failed — using local fallback');
    effectiveProvider = 'local-fallback';
    raw = localOptimize(text, input.category);
  }

  const { text: optimizedText, truncated } = postProcess(raw);
  if (truncated) {
    logger.warn(
      { provider: effectiveProvider, category: input.category },
      `AI response exceeded ${config.ai.maxOutputChars} characters and was truncated`,
    );
  }
  if (!optimizedText) {
    throw serviceUnavailable('Die Textoptimierung lieferte kein Ergebnis. Bitte erneut versuchen.');
  }

  await Promise.all([
    cacheSet(cacheKey, optimizedText),
    aiCacheRepository.set(cacheKey, optimizedText, effectiveProvider),
  ]);

  return { optimizedText, provider: effectiveProvider, cached: false };
}

export const _internal = { stripPreamble, REPLACEMENTS, CATEGORY_LABELS };
