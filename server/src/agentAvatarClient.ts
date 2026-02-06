import type { Env } from "./env.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function postJson<T>(url: string, env: Env, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": env.INTERNAL_API_SECRET
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`agent-avatar error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(url: string, env: Env): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Internal-Secret": env.INTERNAL_API_SECRET
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`agent-avatar error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

export async function agentChat(env: Env, messages: ChatMessage[]): Promise<string> {
  const out = await postJson<{ text: string }>(`${env.AGENT_AVATAR_URL}/internal/openai/chat`, env, { messages });
  return out.text;
}

export async function agentLiveAvatarStart(
  env: Env,
  opts?: { avatarId?: string }
): Promise<{
  sessionId: string;
  sessionToken: string;
  livekitUrl: string;
  livekitToken: string;
  wsUrl: string | null;
}> {
  return await postJson(`${env.AGENT_AVATAR_URL}/internal/liveavatar/start`, env, {
    avatarId: opts?.avatarId
  });
}

export async function agentLiveAvatarStartWithPersona(
  env: Env,
  persona: { avatarId?: string; voiceId: string; contextId: string; language?: string }
): Promise<{ sessionId: string; sessionToken: string; livekitUrl: string; livekitToken: string; wsUrl: string | null }> {
  return await postJson(`${env.AGENT_AVATAR_URL}/internal/liveavatar/start`, env, persona);
}

export async function agentLiveAvatarStop(env: Env, sessionToken: string): Promise<void> {
  await postJson(`${env.AGENT_AVATAR_URL}/internal/liveavatar/stop`, env, { sessionToken });
}

export async function agentListVoices(env: Env): Promise<unknown> {
  return await getJson(`${env.AGENT_AVATAR_URL}/internal/liveavatar/voices`, env);
}

export async function agentListContexts(env: Env): Promise<unknown> {
  return await getJson(`${env.AGENT_AVATAR_URL}/internal/liveavatar/contexts`, env);
}

export async function agentRealtimeConnect(
  env: Env,
  params: {
    sessionId: string;
    livekitUrl: string;
    livekitToken: string;
    systemPrompt: string;
  }
): Promise<{ ok: boolean; sessionId: string }> {
  return await postJson(`${env.AGENT_AVATAR_URL}/internal/realtime/connect`, env, params);
}

export async function agentRealtimeDisconnect(env: Env, sessionId: string): Promise<{ ok: boolean }> {
  return await postJson(`${env.AGENT_AVATAR_URL}/internal/realtime/disconnect`, env, { sessionId });
}
