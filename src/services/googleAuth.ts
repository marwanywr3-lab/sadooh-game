// Only the public game origin is a valid OAuth return destination.
export function googleRedirectUrl(current: string): string {
 const source = new URL(current);
 const target = new URL('https://sadoh.marwanbarbood.com/');
 target.searchParams.set('auth', 'google');
 const room = source.searchParams.get('room') || '';
 if (/^[a-f0-9]{32}$/i.test(room)) {
  target.searchParams.set('room', room);
  if (source.searchParams.get('party') === '1') target.searchParams.set('party', '1');
 }
 return target.href;
}

export function googleCallbackStatus(current: string) {
 const url = new URL(current);
 const hash = new URLSearchParams(url.hash.slice(1));
 return {
  active: url.searchParams.get('auth') === 'google',
  failed: url.searchParams.has('error') || hash.has('error'),
 };
}
