/**
 * Generates the VAPID keypair that signs push notifications.
 *
 *   npx tsx scripts/generate-vapid-keys.ts
 *
 * Run this once. Put both values in .env.local and in Vercel's environment
 * variables, then never change them: the public key is baked into every
 * device subscription, so rotating it silently breaks notifications for
 * everyone who already installed the app.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log(`
Add these to .env.local and to your Vercel project settings.
Keep the private key secret. Do not commit it.

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
`);
