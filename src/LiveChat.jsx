import React, { useState, useEffect, useRef, useCallback } from "react";
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
    default: { name: "Classic", myBubble: "#646cff", theirBubble: "#ec4899", bg: "transparent", emoji: "💬" },
    love: { name: "Love", myBubble: "#ef4444", theirBubble: "#ec4899", bg: "linear-gradient(180deg, rgba(236,72,153,0.05) 0%, transparent 100%)", emoji: "❤️" },
    ocean: { name: "Ocean", myBubble: "#0ea5e9", theirBubble: "#14b8a6", bg: "linear-gradient(180deg, rgba(14,165,233,0.05) 0%, transparent 100%)", emoji: "🌊" },
    sunset: { name: "Sunset", myBubble: "#f97316", theirBubble: "#a855f7", bg: "linear-gradient(180deg, rgba(249,115,22,0.05) 0%, transparent 100%)", emoji: "🌅" },
    forest: { name: "Forest", myBubble: "#22c55e", theirBubble: "#10b981", bg: "linear-gradient(180deg, rgba(34,197,94,0.05) 0%, transparent 100%)", emoji: "🌲" },
    galaxy: { name: "Galaxy", myBubble: "#8b5cf6", theirBubble: "#6366f1", bg: "linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%)", emoji: "🌌" }
};

// Sticker packs
const STICKER_PACKS = {
    love: { emoji: "❤️", stickers: ["❤️", "💕", "💖", "💗", "💓", "💞", "💘", "💝", "😍", "🥰", "😘", "💋"] },
    cute: { emoji: "🥺", stickers: ["🥺", "🤗", "😊", "☺️", "🥹", "😚", "🤭", "😋", "🙈", "🐰", "🦋", "🌸"] },
    reactions: { emoji: "🔥", stickers: ["😂", "😭", "🔥", "✨", "💀", "😱", "🤯", "😤", "🙄", "👀", "💯", "🎉"] },
    animals: { emoji: "🐱", stickers: ["🐱", "🐶", "🐻", "🦊", "🐼", "🐨", "🦁", "🐯", "🐰", "🐸", "🦄", "🐝"] },
    food: { emoji: "🍕", stickers: ["🍕", "🍔", "🍟", "🍦", "🍩", "🍪", "🧁", "🍰", "🍫", "☕", "🧋", "🍜"] }
};

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
const COMMON_EMOJIS = ["😀", "😂", "🥰", "😍", "😘", "🥺", "😭", "😤", "🔥", "✨", "💕", "❤️", "💖", "💗", "👍", "👏", "🙌", "🤗", "😱", "😴", "😋", "🎉", "💀", "👀", "🥱", "🤔", "🤭", "😈", "🙄", "💯", "🫶", "✌️"];

const LiveChat = ({ theme, isPopup = false }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [role, setRole] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState("connecting");
    const [chatTheme, setChatTheme] = useState("default");
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [activeStickerPack, setActiveStickerPack] = useState("love");
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [activeReactionMessage, setActiveReactionMessage] = useState(null);
    const [error, setError] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const lastMessageCountRef = useRef(0);
    const isTabFocusedRef = useRef(true);

    // Play notification sound
    const playSound = useCallback(() => {
        if (!soundEnabled) return;
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = "sine";
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) { /* ignore */ }
    }, [soundEnabled]);

    // Track tab focus
    useEffect(() => {
        const handleVisibility = () => { isTabFocusedRef.current = !document.hidden; };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

    // Load saved settings
    useEffect(() => {
        const savedRole = localStorage.getItem("haizur-chat-role");
        const savedTheme = localStorage.getItem("haizur-chat-theme");
        const savedSound = localStorage.getItem("haizur-chat-sound");
        if (savedRole) setRole(savedRole);
        if (savedTheme && CHAT_THEMES[savedTheme]) setChatTheme(savedTheme);
        if (savedSound !== null) setSoundEnabled(savedSound === "true");
        setIsLoading(false);
    }, []);

    // Save preferences
    useEffect(() => { localStorage.setItem("haizur-chat-theme", chatTheme); }, [chatTheme]);
    useEffect(() => { localStorage.setItem("haizur-chat-sound", String(soundEnabled)); }, [soundEnabled]);

    // Show browser notification
    const showNotification = useCallback((senderName, text) => {
        if (Notification.permission !== "granted" || isTabFocusedRef.current) return;
        try {
            const n = new Notification(`💬 ${senderName}`, {
                body: text?.substring(0, 100) || "Sent a sticker",
                icon: "https://em-content.zobj.net/source/apple/391/sparkling-heart_1f496.png",
                tag: "haizur-chat"
            });
            n.onclick = () => { window.focus(); n.close(); };
            setTimeout(() => n.close(), 4000);
        } catch (e) { /* ignore */ }
    }, []);

    // Subscribe to Firestore messages - REAL-TIME SYNC
    useEffect(() => {
        if (!role) return;

        setConnectionStatus("connecting");
        setError(null);

        const q = query(
            collection(firestore, "chat-messages"),
            orderBy("timestamp", "asc"),
            limit(500)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                setConnectionStatus("connected");
                const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Check for new messages from partner
                if (msgs.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
                    const latest = msgs[msgs.length - 1];
                    if (latest?.sender !== role) {
                        const name = latest.sender === "princess" ? "Princess 👸" : "Haidar ⭐";
                        showNotification(name, latest.text || latest.sticker);
                        playSound();
                    }
                }
                lastMessageCountRef.current = msgs.length;
                setMessages(msgs);
            },
            (err) => {
                console.error("Firestore error:", err);
                setConnectionStatus("error");
                setError("Connection failed. Check Firebase rules.");
            }
        );

        return () => unsubscribe();
    }, [role, showNotification, playSound]);

    // Auto-scroll
    useEffect(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }, [messages]);

    // Focus input
    useEffect(() => {
        if (role && inputRef.current) setTimeout(() => inputRef.current?.focus(), 300);
    }, [role, showEmojiPicker, showStickerPicker]);

    const selectRole = async (selectedRole) => {
        setRole(selectedRole);
        localStorage.setItem("haizur-chat-role", selectedRole);
        if ("Notification" in window && Notification.permission === "default") {
            await Notification.requestPermission();
        }
    };

    const sendMessage = async (e) => {
        e?.preventDefault();
        const text = newMessage.trim();
        if (!text || !role) return;

        setNewMessage("");
        setShowEmojiPicker(false);
        setShowStickerPicker(false);

        try {
            await addDoc(collection(firestore, "chat-messages"), {
                text,
                sender: role,
                timestamp: serverTimestamp(),
                reactions: []
            });
        } catch (err) {
            console.error("Send error:", err);
            setNewMessage(text);
            setError("Failed to send. Try again.");
        }
    };

    const sendSticker = async (sticker) => {
        if (!role) return;
        setShowStickerPicker(false);
        try {
            await addDoc(collection(firestore, "chat-messages"), {
                sticker,
                sender: role,
                timestamp: serverTimestamp(),
                reactions: []
            });
        } catch (err) {
            console.error("Send sticker error:", err);
        }
    };

    const toggleReaction = async (messageId, emoji) => {
        if (!role || !messageId) return;
        setActiveReactionMessage(null);

        try {
            const msg = messages.find(m => m.id === messageId);
            const existingReaction = msg?.reactions?.find(r => r.emoji === emoji && r.user === role);
            const ref = doc(firestore, "chat-messages", messageId);

            if (existingReaction) {
                await updateDoc(ref, { reactions: arrayRemove({ emoji, user: role }) });
            } else {
                await updateDoc(ref, { reactions: arrayUnion({ emoji, user: role }) });
            }
        } catch (err) {
            console.error("Reaction error:", err);
        }
    };

    const formatTime = (ts) => {
        if (!ts?.toDate) return "";
        return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatDate = (ts) => {
        if (!ts?.toDate) return "";
        const d = ts.toDate();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Today";
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const groupedMessages = messages.reduce((acc, msg) => {
        const key = msg.timestamp ? formatDate(msg.timestamp) : "Now";
        if (!acc[key]) acc[key] = [];
        acc[key].push(msg);
        return acc;
    }, {});

    const currentTheme = CHAT_THEMES[chatTheme];

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-8 h-8 border-2 border-[var(--main-color)] border-t-transparent rounded-full"
                />
            </div>
        );
    }

    // Role selection
    if (!role) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center gap-6 p-8 min-h-[300px]"
            >
                <div className="text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1 }}
                        className="text-5xl mb-4"
                    >
                        💬
                    </motion.div>
                    <h2 className="text-2xl font-bold text-[var(--text-color)] mb-1">Live Chat</h2>
                    <p className="text-[var(--sub-color)] text-sm">Select your identity to start chatting</p>
                </div>

                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => selectRole("haidar")}
                        className="px-6 py-3 rounded-2xl font-semibold text-white shadow-lg"
                        style={{ background: "linear-gradient(135deg, #646cff, #5558dd)" }}
                    >
                        ⭐ Haidar
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => selectRole("princess")}
                        className="px-6 py-3 rounded-2xl font-semibold text-white shadow-lg"
                        style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }}
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
            className={`flex flex-col ${isPopup ? 'h-[65vh] md:h-[70vh]' : 'w-full max-w-2xl h-[75vh] rounded-2xl mx-4'} overflow-hidden`}
            style={{ background: currentTheme.bg }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[rgba(0,0,0,0.03)] border-b border-[rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <span className="text-xl">{role === "haidar" ? "⭐" : "👸"}</span>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-color)] ${connectionStatus === "connected" ? "bg-green-500" :
                                connectionStatus === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                            }`} />
                    </div>
                    <div>
                        <span className="font-semibold text-[var(--text-color)] text-sm">
                            {role === "haidar" ? "Haidar" : "Princess"}
                        </span>
                        <span className="text-[10px] text-[var(--sub-color)] ml-2">
                            {connectionStatus === "connected" ? "● live" : connectionStatus === "connecting" ? "connecting..." : "offline"}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { setShowThemePicker(!showThemePicker); setShowEmojiPicker(false); setShowStickerPicker(false); }}
                        className={`p-2 rounded-full transition-colors ${showThemePicker ? 'bg-[var(--main-color)] text-white' : 'hover:bg-[rgba(0,0,0,0.05)]'}`}
                    >
                        🎨
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-2 rounded-full hover:bg-[rgba(0,0,0,0.05)] transition-colors"
                    >
                        {soundEnabled ? "🔔" : "🔕"}
                    </motion.button>
                    <button
                        onClick={() => { localStorage.removeItem("haizur-chat-role"); setRole(null); }}
                        className="text-xs text-[var(--sub-color)] hover:text-[var(--text-color)] px-2 py-1 rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-colors ml-1"
                    >
                        Switch
                    </button>
                </div>
            </div>

            {/* Theme picker */}
            <AnimatePresence>
                {showThemePicker && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-[var(--bg-color)] border-b border-[rgba(0,0,0,0.05)]"
                    >
                        <div className="flex gap-2 p-3 overflow-x-auto">
                            {Object.entries(CHAT_THEMES).map(([key, t]) => (
                                <motion.button
                                    key={key}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setChatTheme(key); setShowThemePicker(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${chatTheme === key
                                            ? "bg-[var(--main-color)] text-white shadow-md"
                                            : "bg-[rgba(0,0,0,0.05)] text-[var(--text-color)] hover:bg-[rgba(0,0,0,0.1)]"
                                        }`}
                                >
                                    {t.emoji} {t.name}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error banner */}
            {error && (
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    className="bg-red-500/10 text-red-500 text-xs px-4 py-2 text-center"
                >
                    {error}
                </motion.div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date}>
                        <div className="flex justify-center my-4">
                            <span className="text-[10px] text-[var(--sub-color)] bg-[rgba(0,0,0,0.05)] px-3 py-1 rounded-full">
                                {date}
                            </span>
                        </div>

                        {msgs.map((msg, idx) => {
                            const isMe = msg.sender === role;
                            const bubbleColor = isMe ? currentTheme.myBubble : currentTheme.theirBubble;
                            const reactions = msg.reactions || [];
                            const isSticker = !!msg.sticker;

                            return (
                                <motion.div
                                    key={msg.id || idx}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}
                                >
                                    <div className="relative max-w-[80%]">
                                        <motion.div
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setActiveReactionMessage(activeReactionMessage === msg.id ? null : msg.id)}
                                            className={`cursor-pointer ${isSticker ? 'p-2' : 'px-3.5 py-2'} rounded-2xl ${isMe ? "rounded-br-md" : "rounded-bl-md"
                                                }`}
                                            style={{
                                                backgroundColor: isSticker ? 'transparent' : bubbleColor,
                                                color: isSticker ? 'inherit' : '#fff'
                                            }}
                                        >
                                            {isSticker ? (
                                                <motion.span
                                                    className="text-6xl block"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: "spring", stiffness: 400 }}
                                                >
                                                    {msg.sticker}
                                                </motion.span>
                                            ) : (
                                                <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                                            )}
                                            {!isSticker && (
                                                <p className="text-[9px] opacity-60 text-right mt-0.5">
                                                    {formatTime(msg.timestamp)}
                                                </p>
                                            )}
                                        </motion.div>

                                        {/* Reactions */}
                                        {reactions.length > 0 && (
                                            <div className={`absolute -bottom-2 ${isMe ? "right-1" : "left-1"} flex gap-0.5`}>
                                                {[...new Set(reactions.map(r => r.emoji))].slice(0, 4).map((emoji, i) => (
                                                    <motion.span
                                                        key={i}
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="text-xs bg-[var(--bg-color)] shadow-sm rounded-full px-1 cursor-pointer hover:scale-110 transition-transform"
                                                        onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                                    >
                                                        {emoji}
                                                    </motion.span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Quick reactions popup */}
                                        <AnimatePresence>
                                            {activeReactionMessage === msg.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5, scale: 0.9 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 5, scale: 0.9 }}
                                                    transition={{ duration: 0.15 }}
                                                    className={`absolute ${isMe ? "right-0" : "left-0"} -top-9 bg-[var(--bg-color)] shadow-lg rounded-full px-1.5 py-1 flex gap-0.5 z-20 border border-[rgba(0,0,0,0.05)]`}
                                                >
                                                    {QUICK_REACTIONS.map((emoji) => (
                                                        <motion.button
                                                            key={emoji}
                                                            whileHover={{ scale: 1.3 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                                            className="text-lg p-0.5 hover:bg-[rgba(0,0,0,0.05)] rounded-full transition-colors"
                                                        >
                                                            {emoji}
                                                        </motion.button>
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
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-[var(--bg-color)] border-t border-[rgba(0,0,0,0.05)]"
                    >
                        <div className="grid grid-cols-8 gap-1 p-3 max-h-32 overflow-y-auto">
                            {COMMON_EMOJIS.map((emoji) => (
                                <motion.button
                                    key={emoji}
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => { setNewMessage(prev => prev + emoji); inputRef.current?.focus(); }}
                                    className="text-xl p-1 rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-colors"
                                >
                                    {emoji}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sticker picker */}
            <AnimatePresence>
                {showStickerPicker && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-[var(--bg-color)] border-t border-[rgba(0,0,0,0.05)]"
                    >
                        <div className="flex gap-1 px-3 pt-3 overflow-x-auto">
                            {Object.entries(STICKER_PACKS).map(([key, pack]) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveStickerPack(key)}
                                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${activeStickerPack === key
                                            ? "bg-[var(--main-color)] text-white"
                                            : "bg-[rgba(0,0,0,0.05)] text-[var(--text-color)]"
                                        }`}
                                >
                                    {pack.emoji}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-6 gap-1 p-3">
                            {STICKER_PACKS[activeStickerPack].stickers.map((sticker, idx) => (
                                <motion.button
                                    key={idx}
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => sendSticker(sticker)}
                                    className="text-3xl p-2 rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors"
                                >
                                    {sticker}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input area */}
            <form onSubmit={sendMessage} className="p-3 bg-[var(--bg-color)] border-t border-[rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2">
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false); setShowThemePicker(false); }}
                        className={`p-2.5 rounded-full transition-colors ${showStickerPicker ? 'bg-[var(--main-color)] text-white' : 'hover:bg-[rgba(0,0,0,0.05)]'}`}
                    >
                        🎭
                    </motion.button>
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false); setShowThemePicker(false); }}
                        className={`p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-[var(--main-color)] text-white' : 'hover:bg-[rgba(0,0,0,0.05)]'}`}
                    >
                        😊
                    </motion.button>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Message..."
                        autoComplete="off"
                        className="flex-1 px-4 py-2.5 rounded-2xl bg-[rgba(0,0,0,0.05)] text-[var(--text-color)] placeholder-[var(--sub-color)] outline-none focus:ring-2 focus:ring-[var(--main-color)] focus:ring-opacity-50 transition-all text-sm"
                        style={{ fontSize: '16px' }}
                    />
                    <motion.button
                        type="submit"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={!newMessage.trim()}
                        className="p-2.5 rounded-full font-semibold transition-all disabled:opacity-30"
                        style={{
                            background: newMessage.trim()
                                ? `linear-gradient(135deg, ${role === "princess" ? "#ec4899, #db2777" : "#646cff, #5558dd"})`
                                : "rgba(0,0,0,0.1)",
                            color: newMessage.trim() ? "#fff" : "var(--sub-color)"
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </motion.button>
                </div>
            </form>
        </div>
    );
};

export default LiveChat;
