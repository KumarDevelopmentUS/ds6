# UI/UX Improvement Roadmap

## 🔴 HIGH PRIORITY

### 1. Visual Identity & Brand Differentiation
- [ ] Choose unique brand color palette (replace iOS system blue #007AFF)
- [ ] Create simple logo/wordmark for header
- [ ] Add distinctive accent color for achievements, wins, celebrations

### 2. Onboarding Flow
- [ ] Add 3-4 screen onboarding carousel for first-time users:
  - "Track your Beer Die games in real-time"
  - "Compete with friends on leaderboards"
  - "Join communities and share your stats"
  - "Let's set up your profile"
- [ ] Add contextual tooltips on first use of key features

### 3. Information Architecture - Home Screen
- [ ] Create clear visual hierarchy with distinct sections
- [ ] Move debug/testing buttons to developer menu (long-press on version number)
- [ ] Group related actions: "Play" section and "Social" section
- [ ] Consider dashboard-style layout with cards

---

## 🟡 MEDIUM PRIORITY

### 4. Micro-interactions & Feedback
- [ ] Add celebration animations when game is won (confetti, particles)
- [ ] Add achievement unlock animations (badge animation)
- [ ] Add streak milestone animations
- [ ] Add optional sound effects (toggle in settings)
- [ ] Animate score changes in tracker (count-up animation)

### 5. Typography Hierarchy
- [ ] Add custom display font for headings (Archivo Black, Bebas Neue, or Sora)
- [ ] Keep system fonts for body text
- [ ] Add more visual weight distinction between stat numbers and labels

### 6. Empty States Enhancement
- [ ] Add illustrations or animated icons instead of just Ionicons
- [ ] Make empty states more actionable with clear CTAs
- [ ] Add personality to copy ("No matches yet? Time to crush some dice!")

### 7. Card Elevation & Depth
- [ ] Use shadow system more consistently (theme.shadows.sm/md/lg)
- [ ] Create hover states for web with subtle lift animations
- [ ] Add subtle gradient overlays or glassmorphism for premium feel

---

## 🟢 LOWER PRIORITY

### 8. Dark Mode Polish
- [ ] Build native dark mode colors properly (remove CSS filter inversion)
- [ ] Ensure images and avatars aren't double-inverted
- [ ] Add dark mode-specific illustrations/graphics

### 9. Loading States Consistency
- [ ] Ensure skeleton layouts match actual content layouts exactly
- [ ] Add staggered animations (delay between skeleton items)
- [ ] Consider shimmer direction consistency (left-to-right everywhere)

### 10. Accessibility Enhancements
- [ ] Add accessibilityLabel to all icon-only buttons
- [ ] Ensure color contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] Add focus indicators for web keyboard navigation
- [ ] Support reduced motion preferences

### 11. Gesture Enhancements (Mobile)
- [ ] Swipe to delete/archive in match history
- [ ] Pull-to-refresh on all list screens
- [ ] Swipe between tabs in tracker view
- [ ] Long-press on player cards for quick actions

### 12. Web-Specific Improvements
- [ ] Expand keyboard shortcuts
- [ ] Hover states on all interactive elements
- [ ] Right-click context menus for power users
- [ ] Responsive breakpoints for larger screens (sidebar navigation on desktop)

---

## 📐 Screen-Specific Improvements

### Tracker Screen (Game in Progress)
- [ ] Add "focused mode" showing only essential controls
- [ ] Add collapsible sections for advanced options
- [ ] Create larger score display visible across the table
- [ ] Add "TV mode" for casting to larger screen

### Stats Screen
- [ ] Add data visualization (bar charts for hit rate, win rate trends)
- [ ] Add "Share Stats" feature to generate shareable image/card
- [ ] Add comparison view ("You vs. Average Player")

### Leaderboard
- [ ] Add rank change indicators (↑2, ↓1, —)
- [ ] Highlight user's rank if not in top visible
- [ ] Add filter by time period (All Time, This Month, This Week)

---

## ⚡ Quick Wins

| Change | Effort | Impact |
|--------|--------|--------|
| Add brand color (replace #007AFF) | Low | High |
| Celebration animation on win | Medium | High |
| Custom font for headings | Low | Medium |
| Remove debug buttons from prod | Low | Medium |
| Add rank change indicators to leaderboard | Low | Medium |
| Swipe-to-refresh on all lists | Low | Medium |

---

*Last updated: January 2026*

