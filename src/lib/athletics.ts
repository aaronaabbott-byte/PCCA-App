/**
 * PA Athletics runs on Ballfrog, a separate app the school already uses.
 * Ballfrog publishes no link that opens the app directly, so this goes to
 * the store listing: on an iPhone with the app installed, the listing shows
 * an Open button, and without it, Get.
 *
 * The Android link is a Play Store search until someone confirms the exact
 * listing. Replace it with the real one when known.
 */
export const ATHLETICS_IOS =
  'https://apps.apple.com/us/app/providence-academy-athletics/id6754607843';
export const ATHLETICS_ANDROID =
  'https://play.google.com/store/search?q=Providence%20Academy%20Athletics&c=apps';

export function athleticsUrl(userAgent: string) {
  return /android/i.test(userAgent) ? ATHLETICS_ANDROID : ATHLETICS_IOS;
}
