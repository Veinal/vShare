const adjectives = [
  "Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Black", "White",
  "Quick", "Slow", "Big", "Small", "Loud", "Quiet", "Happy", "Sad", "Bright",
  "Dark", "Clever", "Brave", "Calm", "Eager", "Fierce", "Gentle", "Jolly",
];

const nouns = [
  "Cat", "Dog", "Fox", "Lion", "Tiger", "Bear", "Bird", "Fish", "Wolf", "Horse",
  "Ant", "Bee", "Cow", "Duck", "Elk", "Frog", "Goat", "Hawk", "Jay", "Kiwi",
  "Lark", "Mule", "Newt", "Owl", "Pig", "Rat", "Swan", "Toad", "Vole", "Yak",
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
