/**
 * Syllable counting utilities for script validation.
 * Ported from predecessor project's programmatic counter.
 */

export function countSyllables(text: string): number {
  const word = text.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  let count = 0;
  const vowels = 'aeiouy';
  let prevIsVowel = false;
  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !prevIsVowel) count++;
    prevIsVowel = isVowel;
  }
  if (word.endsWith('e') && count > 1) count--;
  if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) count++;
  return Math.max(1, count);
}

export function countTextSyllables(text: string): number {
  const words = text.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
  return words.reduce((sum, w) => sum + countSyllables(w), 0);
}
