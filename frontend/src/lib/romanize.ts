// On-device romanisation for Devanagari (Hindi, Marathi, Nepali), spelled the
// way people casually type Hindi in Latin letters ("Hinglish"), so Hindi
// always has a readable fallback even when no server romanisation arrives.

const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
};

const SIGNS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
};

const NUKTA = "़";
const VIRAMA = "्";
const ANUSVARA = "ं";
const CANDRABINDU = "ँ";
const VISARGA = "ः";
const DIGITS = "०१२३४५६७८९";

export function hasDevanagari(text: string) {
  return /[ऀ-ॿ]/.test(text);
}

function romanizeWord(word: string): string {
  const chars = Array.from(word.normalize("NFC"));
  const out: string[] = [];
  // Track where an inherent "a" was added so schwa deletion can drop it.
  const inherent: number[] = [];

  for (let i = 0; i < chars.length; i++) {
    let c = chars[i];
    if (chars[i + 1] === NUKTA) {
      c += NUKTA;
      i++;
    }
    const cons = CONSONANTS[c] ?? CONSONANTS[c.normalize("NFC")];
    if (cons !== undefined) {
      out.push(cons);
      const next = chars[i + 1];
      if (next === VIRAMA) {
        i++;
      } else if (next && SIGNS[next] !== undefined) {
        out.push(SIGNS[next]);
        i++;
      } else {
        inherent.push(out.length);
        out.push("a");
      }
      continue;
    }
    if (VOWELS[c] !== undefined) out.push(VOWELS[c]);
    else if (c === ANUSVARA || c === CANDRABINDU) out.push("n");
    else if (c === VISARGA) out.push("h");
    else if (DIGITS.includes(c)) out.push(String(DIGITS.indexOf(c)));
    else if (c === "।" || c === "॥") out.push(".");
    else out.push(c);
  }

  // Hindi drops the final inherent vowel ("kamal", not "kamala") and a medial
  // one in vowel-consonant-_-consonant-vowel position ("samajhta", "aapko").
  if (inherent.length && inherent[inherent.length - 1] === out.length - 1 && out.length > 2) out.pop();
  const isVowel = (s?: string) => Boolean(s) && /[aeiou]$/.test(s as string);
  for (let k = inherent.length - 1; k >= 0; k--) {
    const at = inherent[k];
    if (at < 2 || at >= out.length - 2) continue;
    if (isVowel(out[at - 2]) && /^[aeiou]/.test(out[at + 2] || "")) out[at] = "";
  }
  // Casual spelling shortens long final vowels: "kya", "abhi", "bhi".
  return out
    .join("")
    .replace(/(\w)aa(?=\W*$)/, "$1a")
    .replace(/(\w)ee(?=\W*$)/, "$1i");
}

export function romanizeDevanagari(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => {
      if (!hasDevanagari(w)) return w;
      const m = /^([^\u0900-\u0963\u0966-\u097F]*)(.*?)([^\u0900-\u0963\u0966-\u097F]*)$/u.exec(w);
      return m ? `${m[1]}${romanizeWord(m[2])}${m[3]}` : romanizeWord(w);
    })
    .join("")
    .replace(/[।॥]/g, ".")
    .replace(/\s+([.,!?])/g, "$1");
}
