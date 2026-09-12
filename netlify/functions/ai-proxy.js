// Wake & Move — shared AI proxy
//
// Purpose: let the app's AI features work for people who haven't set up
// their own API key, WITHOUT ever putting a real key in the browser (where
// anyone's dev tools could read it) or in this repository (where anyone
// with GitHub access could read it).
//
// How it works: this file only runs on Netlify's servers, never in a
// browser. The real API key lives in an environment variable you set in
// the Netlify dashboard — Site settings -> Environment variables — which
// this code reads via `process.env`. Nobody who reads this source file
// (including an AI assistant helping you edit it) ever sees the actual
// key value; it isn't typed into any file that gets committed.
//
// REQUIRED SETUP (do this in the Netlify dashboard, not in code):
//   1. Site settings -> Environment variables -> Add a variable:
//        Key:   ANTHROPIC_API_KEY   (or OPENAI_API_KEY / DEEPSEEK_API_KEY)
//        Value: your actual key
//      That's it — the provider is auto-detected from whichever key you
//      set (see detectProvider() below). Only set AI_PROXY_PROVIDER
//      explicitly if you ever have more than one of these keys set at once
//      and need to pick which one actually gets used.
//   2. Optionally also set:
//        AI_PROXY_MODEL = a specific model name (has sane defaults below)
//   3. Redeploy (env var changes need a new deploy to take effect).
//
// COST NOTE: this key is shared by every visitor who hasn't entered their
// own. That's fine for a small demo/app-review audience, but keep an eye
// on usage if this link gets shared widely — this function hard-caps
// max_tokens per request, but it can't stop someone from calling it many
// times.

const DEFAULT_MODELS = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
};

// Hard ceiling regardless of what the client asks for, so a stray or
// abusive request can't run up a large bill on your shared key.
const MAX_ALLOWED_TOKENS = 500;

// Auto-detects which provider to use from whichever key env var is
// actually set, so setting ONE variable (e.g. just OPENAI_API_KEY) is
// enough — you don't also have to remember to set AI_PROXY_PROVIDER to
// match it. Explicit AI_PROXY_PROVIDER always wins if you do set it.
function detectProvider(){
  if(process.env.AI_PROXY_PROVIDER) return process.env.AI_PROXY_PROVIDER;
  if(process.env.OPENAI_API_KEY) return 'openai';
  if(process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if(process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'anthropic'; // nothing set at all — will fail below with a clear message
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 4000) : '';
  if (!prompt) return { statusCode: 400, body: 'Missing prompt' };
  const maxTokens = Math.min(MAX_ALLOWED_TOKENS, Number(body.maxTokens) || 100);

  const provider = detectProvider();
  const model = process.env.AI_PROXY_MODEL || DEFAULT_MODELS[provider];

  try {
    let text = null;

    if (provider === 'openai' || provider === 'deepseek') {
      const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return { statusCode: 500, body: `Server is missing its API key env var for provider "${provider}"` };

      const url = provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.deepseek.com/chat/completions';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return { statusCode: 502, body: `Upstream error: ${res.status}` };
      const data = await res.json();
      text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return { statusCode: 500, body: `Server is missing its API key env var for provider "${provider}"` };

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return { statusCode: 502, body: `Upstream error: ${res.status}` };
      const data = await res.json();
      text = data && data.content && data.content[0] && data.content[0].text;
    }

    if (!text) return { statusCode: 502, body: 'No text in upstream response' };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    };
  } catch (e) {
    return { statusCode: 500, body: 'Proxy error' };
  }
};
