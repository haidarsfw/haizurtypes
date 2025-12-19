import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { firestore } from "./firebase";
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    limit
} from "firebase/firestore";

const LiveChat = ({ theme }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [role, setRole] = useState(null); // 'haidar' or 'princess'
    const [isLoading, setIsLoading] = useState(true);
    const [notificationPermission, setNotificationPermission] = useState("default");
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const lastMessageCountRef = useRef(0);
    const isTabFocusedRef = useRef(true);

    // Track tab focus for notifications
    useEffect(() => {
        const handleVisibilityChange = () => {
            isTabFocusedRef.current = !document.hidden;
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    // Check notification permission on mount
    useEffect(() => {
        if ("Notification" in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // Request notification permission
    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    };

    // Show notification for new message
    const showNotification = (senderName, messageText) => {
        if (notificationPermission !== "granted") return;
        if (isTabFocusedRef.current) return; // Don't notify if tab is focused

        try {
            const notification = new Notification(`💬 ${senderName}`, {
                body: messageText.substring(0, 100),
                icon: "https://em-content.zobj.net/source/apple/391/sparkling-heart_1f496.png",
                tag: "haizur-chat",
                requireInteraction: false
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        } catch (error) {
            console.error("Error showing notification:", error);
        }
    };

    // Load saved role from localStorage
    useEffect(() => {
        const savedRole = localStorage.getItem("haizur-chat-role");
        if (savedRole) {
            setRole(savedRole);
        }
        setIsLoading(false);
    }, []);

    // Subscribe to messages from Firestore
    useEffect(() => {
        if (!role) return;

        const q = query(
            collection(firestore, "chat-messages"),
            orderBy("timestamp", "asc"),
            limit(200)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Check for new messages from partner
            if (msgs.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
                const latestMessage = msgs[msgs.length - 1];
                if (latestMessage && latestMessage.sender !== role) {
                    const senderName = latestMessage.sender === "princess" ? "Princess 👸" : "Haidar ⭐";
                    showNotification(senderName, latestMessage.text);
                }
            }
            lastMessageCountRef.current = msgs.length;

            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [role, notificationPermission]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input after selecting role
    useEffect(() => {
        if (role && inputRef.current) {
            inputRef.current.focus();
        }
    }, [role]);

    const selectRole = async (selectedRole) => {
        setRole(selectedRole);
        localStorage.setItem("haizur-chat-role", selectedRole);

        // Request notification permission after role selection
        await requestNotificationPermission();
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !role) return;

        const messageText = newMessage.trim();
        setNewMessage("");

        try {
            await addDoc(collection(firestore, "chat-messages"), {
                text: messageText,
                sender: role,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message:", error);
            // Restore message if failed
            setNewMessage(messageText);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    // Group messages by date
    const groupedMessages = messages.reduce((groups, message) => {
        const dateKey = message.timestamp ? formatDate(message.timestamp) : "Now";
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(message);
        return groups;
    }, {});

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-[var(--sub-color)] animate-pulse">Loading...</div>
            </div>
        );
    }

    // Role selection screen
    if (!role) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center gap-8 p-8"
            >
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-[var(--text-color)] mb-2">💬 Live Chat</h2>
                    <p className="text-[var(--sub-color)]">Who are you?</p>
                </div>

                <div className="flex gap-4">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => selectRole("haidar")}
                        className="px-8 py-4 rounded-xl font-bold text-lg transition-all"
                        style={{
                            backgroundColor: "var(--main-color)",
                            color: "var(--bg-color)"
                        }}
                    >
                        ⭐ Haidar
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => selectRole("princess")}
                        className="px-8 py-4 rounded-xl font-bold text-lg transition-all"
                        style={{
                            backgroundColor: "#ff69b4",
                            color: "#fff"
                        }}
                    >
                        👸 Princess
                    </motion.button>
                </div>

                <p className="text-xs text-[var(--sub-color)] opacity-50">
                    Your choice is saved locally
                </p>
            </motion.div>
        );
    }

    // Chat interface
    return (
        <div className="w-full max-w-2xl h-[70vh] flex flex-col bg-[rgba(0,0,0,0.1)] rounded-2xl overflow-hidden mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sub-color)] border-opacity-20">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{role === "haidar" ? "⭐" : "👸"}</span>
                    <div>
                        <div className="font-bold text-[var(--text-color)] text-sm">
                            {role === "haidar" ? "Haidar" : "Princess"}
                        </div>
                        <div className="text-xs text-[var(--sub-color)]">Online</div>
                    </div>
                </div>
                <button
                    onClick={() => {
                        localStorage.removeItem("haizur-chat-role");
                        setRole(null);
                    }}
                    className="text-xs text-[var(--sub-color)] hover:text-[var(--text-color)] transition"
                >
                    Switch
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                    <div key={date}>
                        {/* Date divider */}
                        <div className="flex items-center justify-center my-4">
                            <span className="text-xs text-[var(--sub-color)] bg-[var(--bg-color)] px-3 py-1 rounded-full">
                                {date}
                            </span>
                        </div>

                        {/* Messages for this date */}
                        {dateMessages.map((message, idx) => {
                            const isMe = message.sender === role;
                            const isPrincess = message.sender === "princess";

                            return (
                                <motion.div
                                    key={message.id || idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[75%] px-4 py-2 rounded-2xl ${isMe
                                            ? "rounded-br-md"
                                            : "rounded-bl-md"
                                            }`}
                                        style={{
                                            backgroundColor: isMe
                                                ? "var(--main-color)"
                                                : isPrincess
                                                    ? "#ff69b4"
                                                    : "var(--sub-color)",
                                            color: isMe || isPrincess ? "#fff" : "var(--bg-color)"
                                        }}
                                    >
                                        <p className="text-sm break-words">{message.text}</p>
                                        <p
                                            className="text-[10px] mt-1 opacity-70 text-right"
                                        >
                                            {formatTime(message.timestamp)}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-3 border-t border-[var(--sub-color)] border-opacity-20">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-color)] text-[var(--text-color)] placeholder-[var(--sub-color)] outline-none focus:ring-2 focus:ring-[var(--main-color)] transition"
                    />
                    <motion.button
                        type="submit"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={!newMessage.trim()}
                        className="px-5 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                        style={{
                            backgroundColor: role === "princess" ? "#ff69b4" : "var(--main-color)",
                            color: "#fff"
                        }}
                    >
                        Send
                    </motion.button>
                </div>
            </form>
        </div>
    );
};

export default LiveChat;
