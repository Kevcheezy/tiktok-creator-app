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

export interface SentencePacing {
  text: string;
  wordCount: number;
  syllableCount: number;
}

export interface PacingAnalysis {
  sentences: SentencePacing[];
  totalSyllables: number;
  totalWords: number;
  sentenceCount: number;
}

export function analyzeSentencePacing(text: string): PacingAnalysis {
  // Split by sentence boundaries: . ! ? followed by space or end of string
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const analyzed = sentences.map((sentence) => {
    const words = sentence.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
    return {
      text: sentence,
      wordCount: words.length,
      syllableCount: words.reduce((sum, w) => sum + countSyllables(w), 0),
    };
  });

  return {
    sentences: analyzed,
    totalSyllables: analyzed.reduce((sum, s) => sum + s.syllableCount, 0),
    totalWords: analyzed.reduce((sum, s) => sum + s.wordCount, 0),
    sentenceCount: analyzed.length,
  };
}
