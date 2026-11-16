import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';

let client: Anthropic | null | undefined;

/** Shared Anthropic client, or null when ANTHROPIC_API_KEY isn't configured. */
export function getAnthropic(): Anthropic | null {
  if (client === undefined) client = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 2 }) : null;
  return client;
}
