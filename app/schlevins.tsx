// app/schlevins.tsx
import { ThemedText } from '@/components/themed/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// const { width } = Dimensions.get('window'); // Unused, removed for linting

export default function SchlevinsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  
  // Game state
  const [diceValues, setDiceValues] = useState<number[]>([1, 1]);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [isWinner, setIsWinner] = useState<boolean>(false);
  
  // Stats counters
  const [rollCount, setRollCount] = useState<number>(0);
  const [winCount, setWinCount] = useState<number>(0);
  const [winPercentage, setWinPercentage] = useState<number>(0);

  // Rigged mode state
  const [isRigged, setIsRigged] = useState<boolean>(false);

  // Animation values
  const [dice1Shake] = useState(new Animated.Value(0));
  const [dice2Shake] = useState(new Animated.Value(0));
  const [winnerScale] = useState(new Animated.Value(1));

  // Refs for timers
  const winTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update win percentage whenever roll count or win count changes
  useEffect(() => {
    if (rollCount > 0) {
      setWinPercentage(Math.round((winCount / rollCount) * 100));
    }
  }, [rollCount, winCount]);

  // Function to generate random dice values and schedule the win message
  const rollDice = () => {
    // Cancel any pending win message
    if (winTimerRef.current) {
      clearTimeout(winTimerRef.current);
      winTimerRef.current = null;
    }

    // Hide any previous win message and start the rolling animation
    setHasRolled(false);
    setIsRolling(true);
    
    // Increment the roll counter
    setRollCount(prevCount => prevCount + 1);

    // Start shake animation
    const shakeAnimation = Animated.parallel([
      Animated.sequence([
        Animated.timing(dice1Shake, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(dice1Shake, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(dice2Shake, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(dice2Shake, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    ]);

    shakeAnimation.start();

    // Start updating dice faces randomly every 100ms during the shaking animation
    rollIntervalRef.current = setInterval(() => {
      setDiceValues([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    // Delay final dice update for suspense (750ms)
    setTimeout(() => {
      // Stop the random dice updates
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      
      // Final dice roll values:
      // In rigged mode, force snake eyes with a 1/4 chance (tripled probability)
      let die1: number, die2: number;
      if (isRigged && Math.random() < (1 / 4)) {
        die1 = 1;
        die2 = 1;
      } else {
        die1 = Math.floor(Math.random() * 6) + 1;
        die2 = Math.floor(Math.random() * 6) + 1;
      }
      setDiceValues([die1, die2]);

      // Determine win conditions (sum 7 or 11, or doubles)
      const sum = die1 + die2;
      const isDouble = die1 === die2;
      const currentIsWinner = sum === 7 || sum === 11 || isDouble;
      setIsWinner(currentIsWinner);

      // End the rolling animation immediately so the user can roll again
      setIsRolling(false);

      // Schedule the win/lose message after 1 second delay (cooldown period)
      winTimerRef.current = setTimeout(() => {
        setHasRolled(true);
        
        // Only increment win counter after the win message displays
        if (currentIsWinner) {
          setWinCount(prevCount => prevCount + 1);
          
          // Winner animation
          Animated.sequence([
            Animated.timing(winnerScale, {
              toValue: 1.1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(winnerScale, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
        
        winTimerRef.current = null;
      }, 1000);
    }, 760);
  };

  // Function to render ASCII dice faces based on dice value
  const renderDiceFace = (value: number) => {
    const dotStyle = {
      color: '#000000',
      fontWeight: 'bold' as const,
    };

    switch (value) {
      case 1:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, { color: '#ff3333' }]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
          </View>
        );
      case 5:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
          </View>
        );
      case 6:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, dotStyle]}>●</ThemedText>
            </View>
          </View>
        );
      default:
        return (
          <View style={styles.diceFace}>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
              <ThemedText style={[styles.dot, styles.emptyDot]}>&nbsp;</ThemedText>
            </View>
          </View>
        );
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (winTimerRef.current) clearTimeout(winTimerRef.current);
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hidden button placed above the title for mobile accessibility */}
        <TouchableOpacity
          onPress={() => setIsRigged(prev => !prev)}
          style={styles.secretButton}
          accessibilityLabel="Toggle Rigged Mode"
        >
          {/* You can optionally include a small indicator for development */}
        </TouchableOpacity>

        <View style={styles.main}>
          <ThemedText style={[styles.title, { color: theme.colors.text }]}>SCHLEVINS</ThemedText>
          <ThemedText style={[styles.description, { color: theme.colors.textSecondary }]}>
            {isRigged
              ? "Roll the dice and win if you get a 7, 11, or doubles."
              : "Roll the dice and win if you get a 7, 11, or doubles!"}
          </ThemedText>

          {/* Stats Container */}
          <View style={styles.statsContainer}>
            <View style={[styles.statBox, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}>
              <ThemedText style={[styles.statLabel, { color: theme.colors.textSecondary }]}>ROLLS</ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.colors.text }]}>{rollCount}</ThemedText>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}>
              <ThemedText style={[styles.statLabel, { color: theme.colors.textSecondary }]}>WINS</ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.colors.text }]}>{winCount}</ThemedText>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}>
              <ThemedText style={[styles.statLabel, { color: theme.colors.textSecondary }]}>WIN %</ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.colors.text }]}>{winPercentage}%</ThemedText>
            </View>
          </View>

          {/* Game Area */}
          <View style={[styles.gameArea, { backgroundColor: theme.colors.card }]}>
            <View style={styles.diceContainer}>
              <Animated.View 
                style={[
                  styles.dice,
                  {
                    transform: [
                      {
                        rotate: dice1Shake.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '10deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {renderDiceFace(diceValues[0])}
              </Animated.View>
              <Animated.View 
                style={[
                  styles.dice,
                  {
                    transform: [
                      {
                        rotate: dice2Shake.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '-10deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {renderDiceFace(diceValues[1])}
              </Animated.View>
            </View>

            {/* Result */}
            <View style={styles.result}>
              {isRolling ? (
                <ThemedText style={[styles.rolling, { color: theme.colors.textSecondary }]}>Rolling...</ThemedText>
              ) : !hasRolled ? (
                <ThemedText style={[styles.waiting, { color: theme.colors.textSecondary }]}>Waiting...</ThemedText>
              ) : isWinner ? (
                <Animated.Text 
                  style={[
                    styles.winner,
                    { 
                      color: theme.colors.primary,
                      transform: [{ scale: winnerScale }] 
                    }
                  ]}
                >
                  {diceValues[0] === 1 && diceValues[1] === 1 ? "SNAKE EYES!!!" : "SCHLEVINS!!!"}
                </Animated.Text>
              ) : (
                <ThemedText style={[styles.loser, { color: theme.colors.textSecondary }]}>Try Again!</ThemedText>
              )}
            </View>

            {/* Roll Button */}
            <TouchableOpacity
              style={[
                styles.rollButton,
                {
                  backgroundColor: isRolling ? theme.colors.buttonSecondary : theme.colors.primary,
                  borderBottomColor: isRolling ? theme.colors.border : theme.colors.primary,
                },
                isRolling && styles.rollButtonDisabled
              ]}
              onPress={rollDice}
              disabled={isRolling}
            >
              <ThemedText style={[
                styles.rollButtonText,
                { color: isRolling ? theme.colors.textSecondary : '#FFFFFF' }
              ]}>
                {isRolling ? "Rolling..." : "Roll Dice"}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Extra space for scrolling */}
          <View style={styles.scrollSpacer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  secretButton: {
    opacity: 0.01, // barely visible but clickable
    padding: 20,
    marginBottom: 10,
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  main: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '300',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 500,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 4,
    borderLeftWidth: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  gameArea: {
    marginTop: 16,
    alignItems: 'center',
    padding: 32,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 10,
  },
  diceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 32,
  },
  dice: {
    width: 100,
    height: 100,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  diceFace: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    fontSize: 24,
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyDot: {
    color: 'transparent',
  },
  result: {
    marginVertical: 16,
    height: 40,
    justifyContent: 'center',
  },
  winner: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  loser: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  waiting: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rolling: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rollButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginTop: 16,
    minWidth: 160,
    borderBottomWidth: 3,
  },
  rollButtonDisabled: {
    // Styles handled inline with theme colors
  },
  rollButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  scrollSpacer: {
    height: 100,
  },
});
