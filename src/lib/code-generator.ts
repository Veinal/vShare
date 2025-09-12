const adjectives = [
  "Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Black", "White", "Gray",
  "Brave", "Calm", "Eager", "Fancy", "Gentle", "Happy", "Jolly", "Kind", "Lively", "Merry",
  "Nice", "Proud", "Silly", "Witty", "Zealous", "Quick", "Quiet", "Sunny", "Cozy", "Vivid"
];

const nouns = [
  "Lion", "Tiger", "Bear", "Wolf", "Fox", "Eagle", "Hawk", "Shark", "Puma", "Jaguar",
  "Cat", "Dog", "Bird", "Fish", "Horse", "Mouse", "Rabbit", "Goat", "Duck", "Panda",
  "Sun", "Moon", "Star", "Cloud", "River", "Ocean", "Flame", "Stone", "Tree", "Flower"
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSessionCode(): string {
  const adjective = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  const number = Math.floor(100 + Math.random() * 900); // 3-digit number
  return `${adjective}-${noun}-${number}`;
}