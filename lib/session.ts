export const ACTIVE_PROFILE_COOKIE_NAME = "active_profile";
export const PROFILE_SESSION_COOKIE_NAME = "profile_session";
export const PROFILE_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function getProfilePath(profileId: string) {
  return `/profiles/${encodeURIComponent(profileId)}`;
}
