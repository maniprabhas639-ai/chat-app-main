import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { getConversation, sendMessage } from "../api/messages.api";

export default function ChatScreen({ route }) {
  const { user } = useAuth();
  const otherUser = route.params?.otherUser;
  const myId = user?._id || user?.id;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getConversation(otherUser._id || otherUser.id, myId);
        if (mounted) setMessages(data);
      } catch (e) {
        console.error("[Chat] load error:", e.message);
      }
    })();
    return () => (mounted = false);
  }, [otherUser, myId]);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");

    try {
      const newMsg = await sendMessage({
        sender: myId,
        receiver: otherUser._id || otherUser.id,
        content: trimmed,
      });
      setMessages((prev) => [...prev, newMsg]);

      // scroll to bottom after sending
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      console.error("[Chat] send error:", e.message);
    }
  };

  const renderItem = ({ item }) => {
    const mine = (item.sender?._id || item.sender) === myId;
    return (
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          backgroundColor: mine ? "#DCF8C6" : "#FFF",
          padding: 10,
          marginVertical: 4,
          maxWidth: "80%",
          borderRadius: 10,
          borderWidth: 0.5,
          borderColor: "#eee",
        }}
      >
        <Text style={{ fontSize: 15 }}>{item.content}</Text>
        <Text style={{ fontSize: 10, color: "#777", marginTop: 4 }}>
          {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={{ flex: 1, padding: 12 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 8,
            borderTopWidth: 1,
            borderColor: "#eee",
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginRight: 8,
              backgroundColor: "#fff",
            }}
          />
          <TouchableOpacity
            onPress={onSend}
            style={{
              backgroundColor: "#0a84ff",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
