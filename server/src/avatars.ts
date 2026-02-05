export type AvatarProfile = {
  key: string;
  name: string;
  description: string;
  avatarId: string;
  voiceId?: string;
  contextId?: string;
};

export const AVATARS: Record<string, AvatarProfile> = {
  female_friendly: {
    key: "female_friendly",
    name: "Марія",
    description: "Дружній жіночий аватар",
    // LiveAvatar avatar id (from .env LIVEAVATAR_AVATAR_ID by default)
    avatarId: "65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0"
  }
};

export function getAvatarByKey(key: string): AvatarProfile {
  const v = AVATARS[key];
  if (!v) {
    throw new Error(`Unknown avatar key: ${key}`);
  }
  return v;
}
