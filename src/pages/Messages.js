import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import "../styles.css";

const socket = io("http://localhost:5000", { autoConnect: false });

function Messages() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Initialize user and socket connection
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      setError("Please log in to view messages.");
      return;
    }
    setUser(storedUser);
    socket.connect();
    socket.emit("join", storedUser.id);
    console.log(`Emitted join for user ${storedUser.id}`);

    // Fetch conversations based on shared jobs
    fetchConversations(storedUser);

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      console.log(`Socket disconnected for user ${storedUser.id}`);
    };
  }, []);

  // Join conversation and fetch messages when a user is selected
  useEffect(() => {
    if (user && selectedUser) {
      socket.emit("join_conversation", { user_id: user.id, other_user_id: selectedUser.id });
      console.log(`Emitted join_conversation for user ${user.id} with ${selectedUser.id}`);
      fetchMessages(user.id, selectedUser.id);
    }
  }, [user, selectedUser]);

  // Listen for real-time messages
  useEffect(() => {
    socket.on("receive_message", (message) => {
      console.log("Received message:", message);
      if (
        (message.sender_id === user?.id && message.receiver_id === selectedUser?.id) ||
        (message.sender_id === selectedUser?.id && message.receiver_id === user?.id)
      ) {
        setMessages((prev) => {
          if (prev.some((msg) => Number(msg.id) === Number(message.id))) {
            console.log(`Skipping duplicate message ID ${message.id}`);
            return prev;
          }
          if (Number(message.sender_id) === Number(user?.id)) {
            console.log(`Skipping sender's own message ID ${message.id}`);
            return prev;
          }
          console.log(`Adding message ID ${message.id} to state`);
          const updatedMessages = [...prev, message].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          if (Number(message.receiver_id) === Number(user?.id) && !message.is_read) {
            markMessageAsRead(message.id);
          }
          console.log("Current messages state:", updatedMessages);
          return updatedMessages;
        });
      } else {
        console.log(`Ignoring message ID ${message.id} (not relevant to current conversation)`);
      }
    });
    socket.on("error", (err) => {
      console.error("Socket error:", err);
      setError(err.message);
    });

    return () => {
      socket.off("receive_message");
      socket.off("error");
    };
  }, [user, selectedUser]);

  // Fetch users with shared approved or completed jobs
  const fetchConversations = async (currentUser) => {
    try {
      let userIds = [];
      if (currentUser.role === "client") {
        const response = await fetch(
          `http://localhost:5000/ongoing-jobs?client_id=${currentUser.id}`
        );
        const ongoingJobs = await response.json();
        const completedResponse = await fetch(
          `http://localhost:5000/completed-jobs?client_id=${currentUser.id}`
        );
        const completedJobs = await completedResponse.json();
  
        userIds = [
          ...new Set([
            ...ongoingJobs
              .filter(job => job.freelancer_id)   // 🛠 Only if freelancer is assigned
              .map(job => job.freelancer_id),
            ...completedJobs
              .filter(job => job.freelancer_id)   // 🛠 Same for completed jobs
              .map(job => job.freelancer_id),
          ]),
        ];
      } else if (currentUser.role === "freelancer") {
        const response = await fetch(
          `http://localhost:5000/ongoing-jobs?freelancer_id=${currentUser.id}`
        );
        const ongoingJobs = await response.json();
        const completedResponse = await fetch(
          `http://localhost:5000/completed-jobs?freelancer_id=${currentUser.id}`
        );
        const completedJobs = await completedResponse.json();
  
        userIds = [
          ...new Set([
            ...ongoingJobs
              .filter(job => job.client_id)   // 🛠 Only if client exists
              .map(job => job.client_id),
            ...completedJobs
              .filter(job => job.client_id)   // 🛠 Same for completed jobs
              .map(job => job.client_id),
          ]),
        ];
      }
  
      if (userIds.length === 0) {
        setConversations([]);
        return;
      }
  
      const users = await Promise.all(
        userIds.map(async (id) => {
          const res = await fetch(`http://localhost:5000/user/profile?user_id=${id}`);
          return await res.json();
        })
      );
      setConversations(users.filter((user) => user && user.id));
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError("Failed to load conversations. Please try again.");
    }
  };
  

  // Fetch message history for a conversation
  const fetchMessages = async (userId, otherUserId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/messages?user_id=${userId}&other_user_id=${otherUserId}`
      );
      const data = await response.json();
      setMessages((prev) => {
        const existingIds = new Set(prev.map((msg) => Number(msg.id)));
        const newMessages = data.filter((msg) => !existingIds.has(Number(msg.id)));
        const updatedMessages = [...prev, ...newMessages].sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        );
        console.log(`Fetched messages for user ${userId} and ${otherUserId}:`, updatedMessages);
        return updatedMessages;
      });
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages.");
    }
  };

  // Send a message
  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !selectedUser || isSending) {
      console.log("Send aborted: Invalid input or already sending");
      return;
    }
    setIsSending(true);
    const messageData = {
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage,
    };
    console.log("Sending HTTP POST for message:", messageData);
    fetch("http://localhost:5000/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData),
    })
      .then((response) => response.json())
      .then((result) => {
        if (!result.message_id) throw new Error(result.message || "Failed to send message");
        const newMessageObj = {
          id: result.message_id,
          sender_id: user.id,
          receiver_id: selectedUser.id,
          content: newMessage,
          created_at: new Date().toISOString(),
          is_read: false,
        };
        setMessages((prev) => {
          if (prev.some((msg) => Number(msg.id) === Number(newMessageObj.id))) {
            console.log(`Skipping duplicate optimistic message ID ${newMessageObj.id}`);
            return prev;
          }
          console.log(`Adding optimistic message ID ${newMessageObj.id} to state`);
          const updatedMessages = [...prev, newMessageObj].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          console.log("Current messages state:", updatedMessages);
          return updatedMessages;
        });
        console.log("Emitting send_message via Socket.IO:", newMessageObj);
        setNewMessage("");
        setError("");
      })
      .catch((err) => {
        console.error("Error sending message:", err);
        setError(err.message);
      })
      .finally(() => {
        setIsSending(false);
      });
  }, [newMessage, selectedUser, user]);

  // Mark a message as read
  const markMessageAsRead = async (messageId) => {
    try {
      await fetch(`http://localhost:5000/messages/${messageId}/read`, {
        method: "POST",
      });
      console.log(`Marked message ID ${messageId} as read`);
    } catch (err) {
      console.error("Error marking message as read:", err);
    }
  };

  if (!user) {
    return <div className="container">{error}</div>;
  }

  return (
    <div className="container messages-container">
      <h2>Messages</h2>
      {error && <p className="error">{error}</p>}
      <div className="messages-layout">
        <div className="conversation-list">
          <h3>Conversations</h3>
          {conversations.length === 0 ? (
            <p>No shared jobs found. Collaborate on a job to start messaging.</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedUser?.id === conv.id ? "selected" : ""}`}
                onClick={() => setSelectedUser(conv)}
              >
                {conv.name} ({conv.role})
              </div>
            ))
          )}
        </div>
        <div className="chat-window">
          {selectedUser ? (
            <>
              <h3>Chat with {selectedUser.name}</h3>
              <div className="message-list">
                {messages.map((msg, index) => {
                  console.log(`Rendering message ID ${msg.id} at index ${index}, content: ${msg.content}`);
                  return (
                    <div
                      key={msg.id}
                      className={`message ${Number(msg.sender_id) === Number(user.id) ? "sent" : "received"}`}
                    >
                      <p>{msg.content}</p>
                      <span>{new Date(msg.created_at).toLocaleString()}</span>
                      {msg.is_read && Number(msg.receiver_id) === Number(user.id) && <span>✓</span>}
                    </div>
                  );
                })}
              </div>
              <div className="message-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button className="btn" onClick={sendMessage} disabled={isSending}>
                  Send
                </button>
              </div>
            </>
          ) : (
            <p>Select a conversation to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;