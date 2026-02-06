import type { Env } from "./env.js";

type SessionTokenResponse = {
  session_id?: string;
  session_token?: string;
  sessionId?: string;
  sessionToken?: string;
};

const LIVEAVATAR_API_BASE = "https://api.liveavatar.com";

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

  // FORCE LITE mode - only visual avatar, no LiveAvatar voice/context
  // All voice and content comes from OpenAI Realtime API
  const body: any = {
    mode: "LITE",
    avatar_id: avatarId
  };

  console.log(`[LiveAvatar] Creating session with avatarId: ${avatarId}, mode: ${body.mode} (visual only)`);

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
  wsUrl: string | null;
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
  console.log("[LiveAvatar] Start session response:", JSON.stringify(response, null, 2));

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

  // Get WebSocket URL for sending audio in LITE mode
  const wsUrl =
    (raw.ws_url as string) ||
    (raw.wsUrl as string) ||
    (raw.websocket_url as string) ||
    (raw.websocketUrl as string) ||
    null;

  if (!livekitUrl || !livekitToken) throw new Error("LiveAvatar start response missing livekit url/token");

  if (wsUrl) {
    console.log("[LiveAvatar] WebSocket URL for audio:", wsUrl);
  } else {
    console.log("[LiveAvatar] No WebSocket URL returned - may need to construct manually");
  }

  return { livekitUrl, livekitToken, wsUrl };
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
