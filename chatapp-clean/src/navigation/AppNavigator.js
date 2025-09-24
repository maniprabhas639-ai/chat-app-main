// src/navigation/AppNavigator.js
import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthContext } from "../context/AuthContext";
import { ROUTES } from "./routes";

// Defensive imports: handle both `module.default` and module itself.
// This avoids "invalid component prop" errors when bundler interop differs.
import HomeScreenModule from "../screens/HomeScreen";
import ChatScreenModule from "../screens/ChatScreen";
import LoginScreenModule from "../screens/LoginScreen";
import RegisterScreenModule from "../screens/RegisterScreen";

const HomeScreen = HomeScreenModule?.default || HomeScreenModule;
const ChatScreen = ChatScreenModule?.default || ChatScreenModule;
const LoginScreen = LoginScreenModule?.default || LoginScreenModule;
const RegisterScreen = RegisterScreenModule?.default || RegisterScreenModule;

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={ROUTES.REGISTER} component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name={ROUTES.HOME}
        component={HomeScreen}
        options={{ title: "Home" }}
      />
      <Stack.Screen
        name={ROUTES.CHAT}
        component={ChatScreen}
        options={{ title: "Chat" }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext) || {};

  // tiny splash while restoring auth state
  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
