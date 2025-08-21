// AppNavigator.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext"; // ✅ custom hook

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { userToken, loading } = useAuth();

  // ✅ Load screens safely
  const HomeScreen     = require("../screens/HomeScreen").default;
  const ChatScreen     = require("../screens/ChatScreen").default;
  const LoginScreen    = require("../screens/LoginScreen").default;
  const RegisterScreen = require("../screens/RegisterScreen").default;

  // 🚀 Show splash or loader while checking AsyncStorage token
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {userToken ? (
          <>
            {/* ✅ Home Screen */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: true, title: "Home" }}
            />

            {/* ✅ Chat Screen (user navigates with params: { userId, username }) */}
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.username
                  ? `Chat with ${route.params.username}`
                  : "Chat",
              })}
            />
          </>
        ) : (
          <>
            {/* ✅ Auth Screens */}
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
