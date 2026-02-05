import type { Env } from "./env.js";

type SessionTokenResponse = {
  session_id?: string;
  session_token?: string;
  sessionId?: string;
  sessionToken?: string;
};

const LIVEAVATAR_API_BASE = "https://api.liveavatar.com";

export type LiveAvatarPersona = {
  voiceId: string;
  contextId: string;
  language?: string;
};

function findFirstStringByKeys(payload: any, keys: string[], maxDepth = 7): string | null {
  const q: Array<{ v: any; d: number }> = [{ v: payload, d: 0 }];
  const seen = new Set<any>();
  while (q.length) {
    const cur = q.shift()!;
    const v = cur.v;
    const d = cur.d;
    if (!v) continue;
    const t = typeof v;
    if (t !== "object") continue;
    if (seen.has(v)) continue;
    seen.add(v);

    for (const k of keys) {
      const candidate = (v as any)[k];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }

    if (d >= maxDepth) continue;
    if (Array.isArray(v)) {
      for (const item of v) q.push({ v: item, d: d + 1 });
    } else {
      for (const item of Object.values(v as any)) q.push({ v: item, d: d + 1 });
    }
  }
  return null;
}

async function getJson(env: Env, url: string): Promise<any> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": env.LIVEAVATAR_API_KEY
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LiveAvatar GET error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }
  return await res.json();
}

export async function createSessionToken(
  env: Env,
  opts?: { avatarId?: string }
): Promise<{
  sessionId: string;
  sessionToken: string;
}> {
  const avatarId = opts?.avatarId || env.LIVEAVATAR_AVATAR_ID;
  let persona: LiveAvatarPersona | null =
    env.LIVEAVATAR_VOICE_ID && env.LIVEAVATAR_CONTEXT_ID
      ? {
          voiceId: env.LIVEAVATAR_VOICE_ID,
          contextId: env.LIVEAVATAR_CONTEXT_ID,
          language: "uk"
        }
      : null;

  if (!persona) {
    // Try auto-pick if the workspace has only 1 option for each.
    const [voicesRaw, contextsRaw] = await Promise.all([
      getJson(env, `${LIVEAVATAR_API_BASE}/v1/voices`),
      getJson(env, `${LIVEAVATAR_API_BASE}/v1/contexts`)
    ]);
    const voiceId = findFirstStringByKeys(voicesRaw, ["voice_id", "voiceId", "id"]);
    const contextId = findFirstStringByKeys(contextsRaw, ["context_id", "contextId", "id"]);
    if (voiceId && contextId) persona = { voiceId, contextId, language: "uk" };
  }

  const body: any = persona
    ? {
        mode: "FULL",
        avatar_id: avatarId,
        avatar_persona: {
          voice_id: persona.voiceId,
          context_id: persona.contextId,
          language: persona.language ?? "uk"
        }
      }
    : {
        mode: "LITE",
        avatar_id: avatarId
      };

  console.log(`[LiveAvatar] Creating session with avatarId: ${avatarId}, mode: ${body.mode}`);

  const res = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": env.LIVEAVATAR_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LiveAvatar token error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  const raw = await res.json();
  const json = (raw.data || raw) as SessionTokenResponse;
  const sessionId = json.session_id ?? json.sessionId;
  const sessionToken = json.session_token ?? json.sessionToken;
  if (!sessionId || !sessionToken) throw new Error("LiveAvatar token response missing session_id/session_token");
  return { sessionId, sessionToken };
}

export async function createSessionTokenWithPersona(
  env: Env,
  persona: LiveAvatarPersona
): Promise<{ sessionId: string; sessionToken: string }> {
  return await createSessionTokenWithPersonaAndAvatar(env, env.LIVEAVATAR_AVATAR_ID, persona);
}

export async function createSessionTokenWithPersonaAndAvatar(
  env: Env,
  avatarId: string,
  persona: LiveAvatarPersona
): Promise<{ sessionId: string; sessionToken: string }> {
  const body: any = {
    mode: "FULL",
    avatar_id: avatarId,
    avatar_persona: {
      voice_id: persona.voiceId,
      context_id: persona.contextId,
      language: persona.language ?? "uk"
    }
  };

  const res = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": env.LIVEAVATAR_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LiveAvatar token error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  const raw = await res.json();
  const json = (raw.data || raw) as SessionTokenResponse;
  const sessionId = json.session_id ?? json.sessionId;
  const sessionToken = json.session_token ?? json.sessionToken;
  if (!sessionId || !sessionToken) throw new Error("LiveAvatar token response missing session_id/session_token");
  return { sessionId, sessionToken };
}

export async function startSession(sessionToken: string): Promise<{
  livekitUrl: string;
  livekitToken: string;
}> {
  const res = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LiveAvatar start error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  const response = await res.json();
  const raw = (response.data || response) as Record<string, unknown>;
  const livekitUrl =
    (raw.livekit_url as string) ||
    (raw.livekitUrl as string) ||
    (raw.url as string) ||
    "";
  const livekitToken =
    (raw.livekit_client_token as string) ||
    (raw.livekitClientToken as string) ||
    (raw.token as string) ||
    "";

  if (!livekitUrl || !livekitToken) throw new Error("LiveAvatar start response missing livekit url/token");
  return { livekitUrl, livekitToken };
}

export async function stopSession(sessionToken: string): Promise<void> {
  const res = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LiveAvatar stop error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`
    );
  }
}

export async function listVoices(env: Env): Promise<unknown> {
  return await getJson(env, `${LIVEAVATAR_API_BASE}/v1/voices`);
}

export async function listContexts(env: Env): Promise<unknown> {
  return await getJson(env, `${LIVEAVATAR_API_BASE}/v1/contexts`);
}
