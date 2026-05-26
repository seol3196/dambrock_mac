export function dateText(value) {
  if (!value?.toDate) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value.toDate());
}

export function hashNumber(value = '', min = -2, max = 2) {
  let hash = 0;
  for (const char of value) hash = (hash << 5) - hash + char.charCodeAt(0);
  const range = max - min + 1;
  return min + Math.abs(hash % range);
}

export function wallTone(id = '') {
  const tones = ['bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-sky-50', 'bg-violet-50'];
  return tones[Math.abs(hashNumber(id, 0, tones.length - 1))];
}
