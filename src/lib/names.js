/**
 * Anonymous name generator — Google Docs style
 * Generates "Anonymous [Adjective] [Animal]" usernames
 */

const adjectives = [
  'Adorable', 'Brave', 'Calm', 'Dazzling', 'Eager',
  'Fearless', 'Gentle', 'Happy', 'Inventive', 'Jolly',
  'Kind', 'Lively', 'Mighty', 'Noble', 'Optimistic',
  'Playful', 'Quick', 'Radiant', 'Swift', 'Thoughtful',
  'Unique', 'Vibrant', 'Wise', 'Xenial', 'Youthful',
  'Zesty', 'Clever', 'Daring', 'Elegant', 'Fierce',
  'Graceful', 'Humble', 'Intuitive', 'Joyful', 'Keen',
  'Lucky', 'Mystic', 'Nimble', 'Outstanding', 'Precise',
];

const animals = [
  'Axolotl', 'Bison', 'Cheetah', 'Dolphin', 'Eagle',
  'Falcon', 'Gazelle', 'Hedgehog', 'Iguana', 'Jaguar',
  'Koala', 'Lemur', 'Manatee', 'Narwhal', 'Octopus',
  'Pangolin', 'Quokka', 'Raccoon', 'Seahorse', 'Toucan',
  'Urchin', 'Vulture', 'Walrus', 'Xerus', 'Yak',
  'Zebra', 'Alpaca', 'Badger', 'Capybara', 'Dragonfly',
  'Flamingo', 'Gecko', 'Hummingbird', 'Ibis', 'Jellyfish',
  'Kiwi', 'Lynx', 'Meerkat', 'Newt', 'Otter',
];

// Google Docs style color palette for user avatars
const colors = [
  '#4285F4', '#EA4335', '#FBBC04', '#34A853',
  '#FF6D01', '#46BDC6', '#7BAAF7', '#F07B72',
  '#FCD04F', '#57BB8A', '#FF8A65', '#4DD0E1',
  '#9FA8DA', '#F48FB1', '#80CBC4', '#AED581',
];

export function generateUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `Anonymous ${adj} ${animal}`;
}

export function getUserColor(username) {
  // Deterministic color from username hash
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(username) {
  // "Anonymous Brave Cheetah" -> "BC"
  const parts = username.split(' ').slice(1);
  return parts.map(p => p[0]).join('').toUpperCase();
}
