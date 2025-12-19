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
    limit,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";

// Chat theme presets
const CHAT_THEMES = {
    default: {
        name: "Default",
        myBubble: "var(--main-color)",
        theirBubble: "#ff69b4",
        background: "transparent",
        emoji: "💬"
    },
    love: {
        name: "Love",
        myBubble: "#e74c3c",
        theirBubble: "#ff69b4",
        background: "linear-gradient(135deg, rgba(255,105,180,0.1), rgba(231,76,60,0.1))",
        emoji: "❤️"
    },
    ocean: {
        name: "Ocean",
        myBubble: "#3498db",
        theirBubble: "#1abc9c",
        background: "linear-gradient(135deg, rgba(52,152,219,0.1), rgba(26,188,156,0.1))",
        emoji: "🌊"
    },
    sunset: {
        name: "Sunset",
        myBubble: "#e67e22",
        theirBubble: "#9b59b6",
        background: "linear-gradient(135deg, rgba(230,126,34,0.1), rgba(155,89,182,0.1))",
        emoji: "🌅"
    },
    forest: {
        name: "Forest",
        myBubble: "#27ae60",
        theirBubble: "#2ecc71",
        background: "linear-gradient(135deg, rgba(39,174,96,0.1), rgba(46,204,113,0.1))",
        emoji: "🌲"
    },
    galaxy: {
        name: "Galaxy",
        myBubble: "#8e44ad",
        theirBubble: "#2c3e50",
        background: "linear-gradient(135deg, rgba(142,68,173,0.15), rgba(44,62,80,0.15))",
        emoji: "🌌"
    }
};

// Sticker packs
const STICKER_PACKS = {
    love: ["❤️", "💕", "💖", "💗", "💓", "💞", "💘", "💝", "😍", "🥰", "😘", "💋"],
    cute: ["🥺", "🤗", "😊", "☺️", "🥹", "😚", "🤭", "😋", "🙈", "🐰", "🦋", "🌸"],
    reactions: ["😂", "😭", "🔥", "✨", "💀", "😱", "🤯", "😤", "🙄", "👀", "💯", "🎉"],
    animals: ["🐱", "🐶", "🐻", "🦊", "🐼", "🐨", "🦁", "🐯", "🐰", "🐸", "🦄", "🐝"],
    food: ["🍕", "🍔", "🍟", "🍦", "🍩", "🍪", "🧁", "🍰", "🍫", "☕", "🧋", "🍜"]
};

// Quick reactions for messages
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

// Notification sound (base64 encoded short beep)
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ8LfK/NkG0DJGF/w86QVAQOToTT45lfAwJEn+XMdB0DA3OA5Nt1EQAFe7bqq04AAllv7t+RCQABSX7a9KYzAAFJl+jbkBQAA155+eGRFQADWYL18akZAwRQhPP0qBoDSn7++Z4PAgVUev7wnBECA1Rn/PWeEgMDVIL+85oRAwNYgP3znhQDAyxw/fOgFwMDVnz99Z0VAwNUfP71nRUDA1R8/fWdFQMDVHz99Z0VAwNUfP31nRUDA1R8/fWdFQMDVHz99Z0VA";

const LiveChat = ({ theme, isPopup = false }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [role, setRole] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notificationPermission, setNotificationPermission] = useState("default");
    const [chatTheme, setChatTheme] = useState("default");
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [activeStickerPack, setActiveStickerPack] = useState("love");
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [activeReactionMessage, setActiveReactionMessage] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const lastMessageCountRef = useRef(0);
    const isTabFocusedRef = useRef(true);
    const audioRef = useRef(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio(NOTIFICATION_SOUND);
        audioRef.current.volume = 0.5;
    }, []);

    // Play notification sound
    const playSound = () => {
        if (soundEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
        }
    };

    // Track tab focus for notifications
    useEffect(() => {
        const handleVisibilityChange = () => {
            isTabFocusedRef.current = !document.hidden;
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    // Load saved settings
    useEffect(() => {
        const savedRole = localStorage.getItem("haizur-chat-role");
        const savedTheme = localStorage.getItem("haizur-chat-theme");
        const savedSound = localStorage.getItem("haizur-chat-sound");

        if (savedRole) setRole(savedRole);
        if (savedTheme) setChatTheme(savedTheme);
        if (savedSound !== null) setSoundEnabled(savedSound === "true");

        setIsLoading(false);

        if ("Notification" in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // Save theme preference
    useEffect(() => {
        localStorage.setItem("haizur-chat-theme", chatTheme);
    }, [chatTheme]);

    // Save sound preference
    useEffect(() => {
        localStorage.setItem("haizur-chat-sound", soundEnabled.toString());
    }, [soundEnabled]);

    // Request notification permission
    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) return;
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
        if (isTabFocusedRef.current) return;

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
            setTimeout(() => notification.close(), 5000);
        } catch (error) {
            console.error("Error showing notification:", error);
        }
    };

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

            if (msgs.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
                const latestMessage = msgs[msgs.length - 1];
                if (latestMessage && latestMessage.sender !== role) {
                    const senderName = latestMessage.sender === "princess" ? "Princess 👸" : "Haidar ⭐";
                    showNotification(senderName, latestMessage.text || latestMessage.sticker || "");
                    playSound();
                }
            }
            lastMessageCountRef.current = msgs.length;
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [role, notificationPermission, soundEnabled]);

    // Auto-scroll to bottom
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
        await requestNotificationPermission();
    };

    const sendMessage = async (e) => {
        e?.preventDefault();
        if (!newMessage.trim() || !role) return;

        const messageText = newMessage.trim();
        setNewMessage("");
        setShowEmojiPicker(false);

        try {
            await addDoc(collection(firestore, "chat-messages"), {
                text: messageText,
                sender: role,
                timestamp: serverTimestamp(),
                reactions: []
            });
        } catch (error) {
            console.error("Error sending message:", error);
            setNewMessage(messageText);
        }
    };

    const sendSticker = async (sticker) => {
        if (!role) return;
        setShowStickerPicker(false);

        try {
            await addDoc(collection(firestore, "chat-messages"), {
                sticker: sticker,
                sender: role,
                timestamp: serverTimestamp(),
                reactions: []
            });
        } catch (error) {
            console.error("Error sending sticker:", error);
        }
    };

    const addReaction = async (messageId, emoji) => {
        if (!role) return;
        setActiveReactionMessage(null);

        try {
            const messageRef = doc(firestore, "chat-messages", messageId);
            await updateDoc(messageRef, {
                reactions: arrayUnion({ emoji, user: role })
            });
        } catch (error) {
            console.error("Error adding reaction:", error);
        }
    };

    const removeReaction = async (messageId, emoji) => {
        if (!role) return;

        try {
            const messageRef = doc(firestore, "chat-messages", messageId);
            await updateDoc(messageRef, {
                reactions: arrayRemove({ emoji, user: role })
            });
        } catch (error) {
            console.error("Error removing reaction:", error);
        }
    };

    const addEmoji = (emoji) => {
        setNewMessage(prev => prev + emoji);
        inputRef.current?.focus();
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

    const groupedMessages = messages.reduce((groups, message) => {
        const dateKey = message.timestamp ? formatDate(message.timestamp) : "Now";
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(message);
        return groups;
    }, {});

    const currentTheme = CHAT_THEMES[chatTheme];

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
                        style={{ backgroundColor: "var(--main-color)", color: "var(--bg-color)" }}
                    >
                        ⭐ Haidar
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => selectRole("princess")}
                        className="px-8 py-4 rounded-xl font-bold text-lg transition-all"
                        style={{ backgroundColor: "#ff69b4", color: "#fff" }}
                    >
                        👸 Princess
                    </motion.button>
                </div>
            </motion.div>
        );
    }

    // Chat interface
    return (
        <div
            className={`flex flex-col ${isPopup ? 'h-[60vh] md:h-[65vh]' : 'w-full max-w-2xl h-[70vh] rounded-2xl mx-4'} overflow-hidden`}
            style={{ background: currentTheme.background }}
        >
            {/* Compact header for popup mode */}
            {isPopup && (
                <div className="flex items-center justify-between px-4 py-2 bg-[rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{role === "haidar" ? "⭐" : "👸"}</span>
                        <span className="font-bold text-[var(--text-color)] text-sm">
                            {role === "haidar" ? "Haidar" : "Princess"}
                        </span>
                        <span className="text-xs text-green-400">● online</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Theme picker button */}
                        <button
                            onClick={() => setShowThemePicker(!showThemePicker)}
                            className="text-lg hover:scale-110 transition"
                            title="Change theme"
                        >
                            🎨
                        </button>
                        {/* Sound toggle */}
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className="text-lg hover:scale-110 transition"
                            title={soundEnabled ? "Mute" : "Unmute"}
                        >
                            {soundEnabled ? "🔔" : "🔕"}
                        </button>
                        {/* Switch user */}
                        <button
                            onClick={() => {
                                localStorage.removeItem("haizur-chat-role");
                                setRole(null);
                            }}
                            className="text-xs text-[var(--sub-color)] hover:text-[var(--text-color)] transition px-2 py-1 rounded bg-[rgba(0,0,0,0.1)]"
                        >
                            Switch
                        </button>
                    </div>
                </div>
            )}

            {/* Theme picker dropdown */}
            <AnimatePresence>
                {showThemePicker && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[var(--bg-color)] border-b border-[var(--sub-color)] border-opacity-20 px-4 py-2"
                    >
                        <div className="flex gap-2 flex-wrap">
                            {Object.entries(CHAT_THEMES).map(([key, t]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setChatTheme(key);
                                        setShowThemePicker(false);
                                    }}
                                    className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 transition ${chatTheme === key
                                            ? "bg-[var(--main-color)] text-white"
                                            : "bg-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.2)]"
                                        }`}
                                >
                                    {t.emoji} {t.name}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                    <div key={date}>
                        <div className="flex items-center justify-center my-4">
                            <span className="text-xs text-[var(--sub-color)] bg-[var(--bg-color)] px-3 py-1 rounded-full">
                                {date}
                            </span>
                        </div>

                        {dateMessages.map((message, idx) => {
                            const isMe = message.sender === role;
                            const isPrincess = message.sender === "princess";
                            const bubbleColor = isMe ? currentTheme.myBubble : currentTheme.theirBubble;
                            const reactions = message.reactions || [];

                            return (
                                <motion.div
                                    key={message.id || idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}
                                >
                                    <div className="relative group">
                                        {/* Message bubble */}
                                        <div
                                            className={`max-w-[75%] px-4 py-2 rounded-2xl ${isMe ? "rounded-br-md" : "rounded-bl-md"
                                                } cursor-pointer`}
                                            style={{ backgroundColor: bubbleColor, color: "#fff" }}
                                            onClick={() => setActiveReactionMessage(
                                                activeReactionMessage === message.id ? null : message.id
                                            )}
                                        >
                                            {message.sticker ? (
                                                <span className="text-5xl">{message.sticker}</span>
                                            ) : (
                                                <p className="text-sm break-words">{message.text}</p>
                                            )}
                                            <p className="text-[10px] mt-1 opacity-70 text-right">
                                                {formatTime(message.timestamp)}
                                            </p>
                                        </div>

                                        {/* Reactions display */}
                                        {reactions.length > 0 && (
                                            <div className={`absolute -bottom-3 ${isMe ? "right-2" : "left-2"} flex gap-0.5`}>
                                                {[...new Set(reactions.map(r => r.emoji))].map((emoji, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-sm bg-[var(--bg-color)] rounded-full px-1 shadow-sm cursor-pointer"
                                                        onClick={() => {
                                                            const myReaction = reactions.find(
                                                                r => r.emoji === emoji && r.user === role
                                                            );
                                                            if (myReaction) {
                                                                removeReaction(message.id, emoji);
                                                            } else {
                                                                addReaction(message.id, emoji);
                                                            }
                                                        }}
                                                    >
                                                        {emoji}
                                                        {reactions.filter(r => r.emoji === emoji).length > 1 && (
                                                            <span className="text-[10px] text-[var(--sub-color)]">
                                                                {reactions.filter(r => r.emoji === emoji).length}
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Quick reactions popup */}
                                        <AnimatePresence>
                                            {activeReactionMessage === message.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                    className={`absolute ${isMe ? "right-0" : "left-0"} -top-10 bg-[var(--bg-color)] rounded-full shadow-lg px-2 py-1 flex gap-1 z-10`}
                                                >
                                                    {QUICK_REACTIONS.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                addReaction(message.id, emoji);
                                                            }}
                                                            className="text-lg hover:scale-125 transition"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            <AnimatePresence>
                {showEmojiPicker && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[var(--bg-color)] border-t border-[var(--sub-color)] border-opacity-20 p-3 max-h-40 overflow-y-auto"
                    >
                        <div className="grid grid-cols-8 gap-2">
                            {["😀", "😂", "🥰", "😍", "😘", "🥺", "😭", "😤", "🔥", "✨", "💕", "❤️", "💖", "💗", "💓", "💞", "👍", "👎", "👏", "🙌", "🤗", "🤔", "🤭", "😱", "😴", "🥱", "😋", "🤤", "🎉", "🎊", "💀", "👀"].map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => addEmoji(emoji)}
                                    className="text-2xl hover:scale-125 transition"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sticker picker */}
            <AnimatePresence>
                {showStickerPicker && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[var(--bg-color)] border-t border-[var(--sub-color)] border-opacity-20 p-3"
                    >
                        {/* Pack tabs */}
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                            {Object.keys(STICKER_PACKS).map((pack) => (
                                <button
                                    key={pack}
                                    onClick={() => setActiveStickerPack(pack)}
                                    className={`px-3 py-1 rounded-full text-sm capitalize whitespace-nowrap transition ${activeStickerPack === pack
                                            ? "bg-[var(--main-color)] text-white"
                                            : "bg-[rgba(0,0,0,0.1)] text-[var(--text-color)]"
                                        }`}
                                >
                                    {pack}
                                </button>
                            ))}
                        </div>
                        {/* Stickers grid */}
                        <div className="grid grid-cols-6 gap-2">
                            {STICKER_PACKS[activeStickerPack].map((sticker, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => sendSticker(sticker)}
                                    className="text-3xl hover:scale-125 transition p-2 rounded-lg hover:bg-[rgba(0,0,0,0.1)]"
                                >
                                    {sticker}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-3 border-t border-[var(--sub-color)] border-opacity-20 bg-[var(--bg-color)]">
                <div className="flex gap-2 items-center">
                    {/* Sticker button */}
                    <button
                        type="button"
                        onClick={() => {
                            setShowStickerPicker(!showStickerPicker);
                            setShowEmojiPicker(false);
                        }}
                        className={`text-xl p-2 rounded-lg transition ${showStickerPicker ? "bg-[var(--main-color)] text-white" : "hover:bg-[rgba(0,0,0,0.1)]"}`}
                    >
                        🎭
                    </button>
                    {/* Emoji button */}
                    <button
                        type="button"
                        onClick={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowStickerPicker(false);
                        }}
                        className={`text-xl p-2 rounded-lg transition ${showEmojiPicker ? "bg-[var(--main-color)] text-white" : "hover:bg-[rgba(0,0,0,0.1)]"}`}
                    >
                        😊
                    </button>
                    {/* Input field */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                        autoCorrect="off"
                        className="flex-1 px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.1)] text-[var(--text-color)] placeholder-[var(--sub-color)] outline-none focus:ring-2 focus:ring-[var(--main-color)] transition text-base"
                        style={{ fontSize: '16px' }}
                    />
                    {/* Send button */}
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
