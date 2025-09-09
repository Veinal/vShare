const adjectives = [
  "red", "blue", "green", "yellow", "purple", "orange", "pink", "black", "white",
  "quick", "slow", "big", "small", "loud", "quiet", "happy", "sad", "bright",
  "dark", "clever", "brave", "calm", "eager", "fierce", "gentle", "jolly",
];

const nouns = [
  "cat", "dog", "fox", "lion", "tiger", "bear", "bird", "fish", "wolf", "horse",
  "ant", "bee", "cow", "duck", "elk", "frog", "goat", "hawk", "jay", "kiwi",
  "lark", "mule", "newt", "owl", "pig", "rat", "swan", "toad", "vole", "yak",
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSessionCode(): string {
  const adjective = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  const number = Math.floor(Math.random() * 100);
  return `${adjective}-${noun}-${number}`;
}
