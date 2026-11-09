export const SR: any = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
export const canListen = !!SR;
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!canSpeak) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'bg-BG';
  const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('bg'));
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  return true;
}
export function hasBgVoice() { return canSpeak && speechSynthesis.getVoices().some(v => v.lang && v.lang.toLowerCase().startsWith('bg')); }

export type Intent = { kind: 'agents' | 'markets' | 'video' | 'publishing' | 'news' | 'focus' | 'create' | 'demo_on' | 'demo_off' | 'help'; arg?: string };
export function parseIntent(raw: string): Intent {
  const t = raw.toLowerCase().replace(/[.,!?„“"]/g, ' ').replace(/^\s*(джарвис|jarvis)\s*/, '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(създай|нова|добави) задача\s*:?\s*(.*)$/);
  if (m) return { kind: 'create', arg: m[2] };
  if (/агент/.test(t)) return { kind: 'agents' };
  if (/пазар/.test(t)) return { kind: 'markets' };
  if (/видео/.test(t)) return { kind: 'video' };
  if (/публикац/.test(t)) return { kind: 'publishing' };
  if (/новин/.test(t)) return { kind: 'news' };
  if (/фокус/.test(t)) return { kind: 'focus' };
  if (/(демо|demo)/.test(t) && /(спри|изключи)/.test(t)) return { kind: 'demo_off' };
  if (/(демо|demo)/.test(t)) return { kind: 'demo_on' };
  return { kind: 'help' };
}
