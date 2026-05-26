export function dateText(value) {
  if (!value?.toDate) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value.toDate());
}

export function hashNumber(value = '', min = 0, max = 100) {
  let hash = 0;
  for (const char of String(value)) hash = (hash << 5) - hash + char.charCodeAt(0);
  const range = max - min + 1;
  return min + Math.abs(hash % range);
}

export function wallTone(id = '') {
  const tones = [
    'bg-rose-50',
    'bg-amber-50',
    'bg-emerald-50',
    'bg-sky-50',
    'bg-orange-50'
  ];
  return tones[Math.abs(hashNumber(id, 0, tones.length - 1))];
}

export function parseTextSegments(text = '') {
  const regex = /(https?:\/\/[^\s]+)/g;
  return String(text)
    .split(regex)
    .filter(Boolean)
    .map((segment) => ({
      type: /^https?:\/\//.test(segment) ? 'link' : 'text',
      value: segment
    }));
}

export function paddedNumber(value, width = 2) {
  return String(value).padStart(width, '0');
}
