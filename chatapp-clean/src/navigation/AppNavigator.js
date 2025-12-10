// src/navigation/AppNavigator.js
import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthContext } from "../context/AuthContext";
import { ROUTES } from "./routes";

import HomeScreenModule from "../screens/HomeScreen";
import ChatScreenModule from "../screens/ChatScreen";
import LoginScreenModule from "../screens/LoginScreen";
import RegisterScreenModule from "../screens/RegisterScreen";
import VerifyEmailScreenModule from "../screens/VerifyEmailScreen";
import ForgotPasswordScreenModule from "../screens/ForgotPasswordScreen"; // 👈 NEW
import ResetPasswordOtpScreenModule from "../screens/ResetPasswordOtpScreen"; // 👈 NEW
import ResetPasswordNewPasswordScreenModule from "../screens/ResetPasswordNewPasswordScreen"; // 👈 NEW

const HomeScreen = HomeScreenModule?.default || HomeScreenModule;
const ChatScreen = ChatScreenModule?.default || ChatScreenModule;
const LoginScreen = LoginScreenModule?.default || LoginScreenModule;
const RegisterScreen = RegisterScreenModule?.default || RegisterScreenModule;
const VerifyEmailScreen =
  VerifyEmailScreenModule?.default || VerifyEmailScreenModule;
const ForgotPasswordScreen =
  ForgotPasswordScreenModule?.default || ForgotPasswordScreenModule;
const ResetPasswordOtpScreen =
  ResetPasswordOtpScreenModule?.default || ResetPasswordOtpScreenModule;
const ResetPasswordNewPasswordScreen =
  ResetPasswordNewPasswordScreenModule?.default ||
  ResetPasswordNewPasswordScreenModule;

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={ROUTES.REGISTER} component={RegisterScreen} />
      <Stack.Screen
        name={ROUTES.VERIFY_EMAIL}
        component={VerifyEmailScreen}
      />
      <Stack.Screen
        name={ROUTES.FORGOT_PASSWORD}
        component={ForgotPasswordScreen}
      />
      <Stack.Screen
        name={ROUTES.RESET_PASSWORD_OTP}
        component={ResetPasswordOtpScreen}
      />
      <Stack.Screen
        name={ROUTES.RESET_PASSWORD_NEW}
        component={ResetPasswordNewPasswordScreen}
      />
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

  if (loading) return null;

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
