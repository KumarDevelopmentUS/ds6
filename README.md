# DieStats - Real-time Die Game Tracker 🎲

Track your die-throwing game stats in real-time with friends. Join live matches, view detailed statistics, and compete with your community.

## Features

- 📊 Real-time stat tracking for die games
- 👥 Multiplayer live sessions
- 📱 Cross-platform (iOS, Android, Web)
- 📈 Detailed analytics and history
- 🏆 Community features and leaderboards
- 📸 Photo sharing for game moments

## Privacy Policy

This app collects minimal data necessary for functionality:
- User authentication data (email, user ID)
- Game statistics and match history
- Profile information (nickname, school, avatar)
- Photos uploaded by users for posts

We use Supabase for secure data storage and do not share personal data with third parties. Camera access is only used when you choose to take photos for posts or profile pictures.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up environment variables

   Create a `.env` file with:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_APP_URL=https://ds6-pi.vercel.app
   ```

3. Start the app

   ```bash
   npx expo start
   ```

## Building for Production

### iOS TestFlight

1. Set up your Apple Developer Account
2. Update `app.json` with your bundle identifier
3. Update `eas.json` with your Apple Team ID and credentials
4. Build for TestFlight:

   ```bash
   npm run build:ios:production
   ```

5. Submit to TestFlight:

   ```bash
   npm run submit:ios
   ```

### Web Deployment

The web version is automatically deployed to Vercel at https://ds6-pi.vercel.app

## Development

- [Expo documentation](https://docs.expo.dev/)
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/)

## Support

For support or questions, contact [your-email@example.com]

## License

Private - All rights reserved
