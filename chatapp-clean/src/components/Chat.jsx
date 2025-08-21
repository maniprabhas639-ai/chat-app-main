// frontend/src/components/Chat.jsx
import React, { useEffect, useState } from "react";
import { socket } from "../api/socket";  // ✅ use shared socket
import { API_BASE_URL } from "../config/config";

export default function Chat({ currentUser, selectedUser }) {
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // Load messages + join room
  useEffect(() => {
    if (currentUser && selectedUser) {
      const newRoom = [currentUser._id, selectedUser._id].sort().join("_");
      setRoom(newRoom);

      // Join socket room
      socket.emit("join_room", newRoom);

      // Fetch previous chat history from backend
      fetch(`${API_BASE_URL}/messages/${newRoom}`)
        .then((res) => res.json())
        .then((data) => setMessages(data))
        .catch((err) => console.error("Failed to load messages", err));

      // Listen for new messages
      socket.on("receive_message", (data) => {
        if (data.room === newRoom) {
          setMessages((prev) => [...prev, data]);
        }
      });

      return () => {
        socket.off("receive_message");
      };
    }
  }, [currentUser, selectedUser]);

  const sendMessage = () => {
    if (message.trim()) {
      const data = {
        room,
        message,
        senderId: currentUser._id,
        sender: currentUser.name,
      };

      // Emit to socket
      socket.emit("send_message", data);

      // Optimistic UI update
      setMessages((prev) => [...prev, data]);
      setMessage("");

      // Save to DB
      fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).catch((err) => console.error("Failed to save message", err));
    }
  };

  return (
    <div className="chat-container">
      <h2>Chat with {selectedUser?.name}</h2>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.sender}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
