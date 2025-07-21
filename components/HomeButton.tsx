import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

// --- IconSymbol Mock Component ---
// This mock is needed here because HomeButton uses IconSymbol.
// In your actual project, ensure this is imported from '@/components/ui/IconSymbol'
// or whichever path you have defined it.
interface IconSymbolProps {
  size: number;
  name: string;
  color: string;
}

const IconSymbol = ({ size, name, color }: IconSymbolProps) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.7, color: color, fontWeight: 'bold' }}>
        {name.split('.')[0][0].toUpperCase()}
      </Text>
    </View>
  );
};
// --- End IconSymbol Mock Component ---


interface HomeButtonProps {
  onPress: () => void;
}

export default function HomeButton({ onPress }: HomeButtonProps) {
  const iconColor = '#ffffff';

  return (
    <TouchableOpacity style={styles.homeButton} onPress={onPress}>
      <IconSymbol size={28} name="house.fill" color={iconColor} />
      <Text style={styles.homeButtonText}>Go to Home</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
