export type OpenAIErrorInfo = { code: string; message: string; status: number };

// Use only known codes. Provider messages can contain account IDs or request data.
export function classifyOpenAIError(status: number, body: unknown, retryAfter?: string | null): OpenAIErrorInfo {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const error = data.error && typeof data.error === 'object' ? data.error as Record<string, unknown> : {};
  const code = typeof error.code === 'string' ? error.code : '';
  const billing: Record<string, string> = {
    credit_balance_exhausted: 'Your OpenAI API credit balance is empty. Add API credits in OpenAI billing, then try again. Built-in works without API credits.',
    organization_spend_limit_exceeded: 'Your OpenAI organization has reached its spending limit. Review that limit in OpenAI settings, or choose Built-in.',
    project_spend_limit_exceeded: 'Your OpenAI project has reached its spending limit. Review the project limit in OpenAI settings, or choose Built-in.',
    organization_usage_limit_exceeded: 'Your OpenAI organization has reached its approved API usage limit. Review your API limits, or choose Built-in.',
    billing_hard_limit_reached: 'Your OpenAI API account has reached its billing limit. Review API billing and limits, or choose Built-in.',
    billing_not_active: 'API billing is not active for your OpenAI account. Set up API billing, or choose Built-in.'
  };
  if (Object.hasOwn(billing, code)) return { code, message: billing[code], status: 429 };
  if (code === 'insufficient_quota' || error.type === 'insufficient_quota') return {
    code: 'insufficient_quota', status: 429,
    message: 'OpenAI blocked generation because your API account has insufficient credits or has reached a billing limit. Check API billing and limits, or choose Built-in. Waiting alone will not fix this.'
  };
  if (status === 401) return { code: 'invalid_api_key', status: 409, message: 'OpenAI rejected the API key. Reconnect your key in ChatGPT.' };
  if (status === 403) return { code: 'openai_access_denied', status: 403, message: 'OpenAI denied this request. Check your API key permissions and the selected model’s access.' };
  if (status === 404 || code === 'model_not_found') return { code: 'model_not_found', status: 400, message: 'This model is not available to your API account. Check the model ID or select another model.' };
  if (status === 429) {
    const seconds = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Math.ceil(Number(retryAfter)) : 0;
    const wait = seconds > 0 && seconds <= 86400 ? `Wait at least ${seconds} seconds` : 'Wait a little';
    return { code: code === 'slow_down' ? 'slow_down' : 'rate_limit_exceeded', status: 429, message: `OpenAI temporarily limited this model’s request rate. ${wait} before trying again, or use Built-in. Check your model’s API rate limits if this continues.` };
  }
  if (status >= 500) return { code: 'openai_unavailable', status: 503, message: 'OpenAI is temporarily unavailable. Try again later or use Built-in.' };
  return { code: 'openai_request_rejected', status: 400, message: 'The selected model rejected the request. Choose a model that supports Responses and structured output, or use Built-in.' };
}
