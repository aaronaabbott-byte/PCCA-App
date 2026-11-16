import { redirect } from 'next/navigation';

// The feed moved to the root route, which is now the News tab. This keeps
// any existing link, bookmark or installed home-screen shortcut to /feed
// working. The per-channel views at /feed/[slug] are untouched.

export default function FeedPage() {
  redirect('/');
}
