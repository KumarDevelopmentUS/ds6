// app/constants/avatarIcons.ts
import { Ionicons } from '@expo/vector-icons';

// Define the type for an avatar icon
export type AvatarIconType = {
  name: keyof typeof Ionicons.glyphMap; // Ensures icon names are valid Ionicons
  label: string;
};

// Curated list of fun Ionicons
export const FUN_AVATAR_ICONS: AvatarIconType[] = [
  { name: 'balloon', label: 'Balloon' },
  { name: 'baseball', label: 'Baseball' },
  { name: 'basketball', label: 'Basketball' },
  { name: 'beer', label: 'Beer' },
  { name: 'bug', label: 'Bug' },
  { name: 'bulb', label: 'Lightbulb' },
  { name: 'camera', label: 'Camera' },
  { name: 'cash', label: 'Cash' },
  { name: 'cloud', label: 'Cloud' },
  { name: 'compass', label: 'Compass' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'dice', label: 'Dice' }, // Since your app is about dice tracking!
  { name: 'eye', label: 'Eye' },
  { name: 'finger-print', label: 'Fingerprint' },
  { name: 'fish', label: 'Fish' },
  { name: 'flash', label: 'Flash' },
  { name: 'flame', label: 'Flame' },
  { name: 'flask', label: 'Flask' },
  { name: 'football', label: 'Football' },
  { name: 'globe', label: 'Globe' },
  { name: 'hammer', label: 'Hammer' },
  { name: 'happy', label: 'Happy Face' },
  { name: 'heart', label: 'Heart' },
  { name: 'ice-cream', label: 'Ice Cream' },
  { name: 'key', label: 'Key' },
  { name: 'magnet', label: 'Magnet' },
  { name: 'nutrition', label: 'Nutrition' },
  { name: 'planet', label: 'Planet' },
  { name: 'prism', label: 'Prism' },
  { name: 'ribbon', label: 'Ribbon' },
  { name: 'rocket', label: 'Rocket' },
  { name: 'shield', label: 'Shield' },
  { name: 'skull', label: 'Skull' },
  { name: 'snow', label: 'Snow' },
  { name: 'sparkles', label: 'Sparkles' },
  { name: 'square', label: 'Square' },
  { name: 'star', label: 'Star' },
  { name: 'sunny', label: 'Sunny' },
  { name: 'thumbs-down', label: 'Thumbs Down' },
  { name: 'thumbs-up', label: 'Thumbs Up' },
  { name: 'trophy', label: 'Trophy' },
  { name: 'walk', label: 'Walk' },
  { name: 'wallet', label: 'Wallet' },
  { name: 'wine', label: 'Wine' },
  { name: 'woman', label: 'Woman' },
];

// Predefined color options (you can expand this)
export const AVATAR_COLORS = [
  '#3b82f6', // Blue (primary)
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
  '#000000', // Black
  '#FFFFFF', // White
  '#a855f7', // Violet
  '#d946b1', // Fuchsia
  '#14b8a6', // Teal
  '#f97316', // Orange
];