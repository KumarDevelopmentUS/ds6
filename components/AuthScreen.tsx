import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/supabase'; // Adjust path based on your lib/supabase.ts location

interface AuthScreenProps {
  onAuthSuccess: () => void; // Callback to navigate after successful login/signup
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Handles both sign-in and sign-up with email and password
  const handleAuth = async (isSignUp: boolean) => {
    setLoading(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      Alert.alert('Authentication Error', error.message);
    } else {
      Alert.alert('Success', isSignUp ? 'Check your email for confirmation!' : 'Logged in successfully!');
      onAuthSuccess(); // Call the callback to navigate
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <TouchableOpacity
        style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
        onPress={() => handleAuth(false)} // Call with false for login
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    width: '90%',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signUpButton: {
    backgroundColor: '#6c757d',
  },
});