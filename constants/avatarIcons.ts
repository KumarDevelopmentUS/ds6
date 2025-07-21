// app/constants/avatarIcons.ts
import { Ionicons } from '@expo/vector-icons';

// Define the type for an avatar icon
export type AvatarIconType = {
  name: keyof typeof Ionicons.glyphMap; // Ensures icon names are valid Ionicons
  label: string;
};

// Curated list of fun Ionicons
export const FUN_AVATAR_ICONS: AvatarIconType[] = [
  { name: 'happy', label: 'Happy Face' },
  { name: 'leaf', label: 'Leaf' },
  { name: 'sparkles', label: 'Sparkles' },
  { name: 'rocket', label: 'Rocket' },
  { name: 'game-controller', label: 'Game Controller' },
  { name: 'flash', label: 'Flash' },
  { name: 'bug', label: 'Bug' },
  { name: 'football', label: 'Football' },
  { name: 'star', label: 'Star' },
  { name: 'heart', label: 'Heart' },
  { name: 'paw', label: 'Paw Print' },
  { name: 'pizza', label: 'Pizza Slice' },
  { name: 'camera', label: 'Camera' },
  { name: 'diamond', label: 'Diamond' },
  { name: 'dice', label: 'Dice' }, // Since your app is about dice tracking!
  { name: 'cafe', label: 'Coffee Cup' },
  { name: 'cloud', label: 'Cloud' },
  { name: 'flower', label: 'Flower' },
  { name: 'gift', label: 'Gift' },
  { name: 'ice-cream', label: 'Ice Cream' },
  { name: 'planet', label: 'Planet' },
  { name: 'shield', label: 'Shield' },
  { name: 'skull', label: 'Skull' },
  { name: 'trophy', label: 'Trophy' },
  { name: 'water', label: 'Water Drop' },
  { name: 'wifi', label: 'Wifi' },
  { name: 'balloon', label: 'Balloon' },
  { name: 'brush', label: 'Brush' },
  { name: 'bulb', label: 'Lightbulb' },
  { name: 'color-filter', label: 'Color Filter' },
  { name: 'compass', label: 'Compass' },
  { name: 'ear', label: 'Ear' },
  { name: 'eye', label: 'Eye' },
  { name: 'finger-print', label: 'Fingerprint' },
  { name: 'fish', label: 'Fish' },
  { name: 'flame', label: 'Flame' },
  { name: 'flask', label: 'Flask' },
  { name: 'globe', label: 'Globe' },
  { name: 'hammer', label: 'Hammer' },
  { name: 'key', label: 'Key' },
  { name: 'layers', label: 'Layers' },
  { name: 'magnet', label: 'Magnet' },
  { name: 'map', label: 'Map' },
  { name: 'medical', label: 'Medical Cross' },
  { name: 'nutrition', label: 'Nutrition' },
  { name: 'pie-chart', label: 'Pie Chart' },
  { name: 'pin', label: 'Pin' },
  { name: 'prism', label: 'Prism' },
  { name: 'ribbon', label: 'Ribbon' },
  { name: 'shapes', label: 'Shapes' },
  { name: 'square', label: 'Square' },
  { name: 'sunny', label: 'Sunny' },
  { name: 'terminal', label: 'Terminal' },
  { name: 'thermometer', label: 'Thermometer' },
  { name: 'toggle', label: 'Toggle' },
  { name: 'wallet', label: 'Wallet' },
  { name: 'wine', label: 'Wine Glass' },
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