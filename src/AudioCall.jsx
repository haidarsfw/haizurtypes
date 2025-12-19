import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { firestore } from "./firebase";
import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    deleteDoc,
    updateDoc,
    getDoc
} from "firebase/firestore";

// STUN servers for NAT traversal (free from Google)
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
    ]
};

// Audio constraints for high quality
const AUDIO_CONSTRAINTS = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
    },
    video: false
};

const AudioCall = ({ role, isOpen, onClose }) => {
    const [callStatus, setCallStatus] = useState("idle"); // idle, calling, incoming, connected, ended
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [error, setError] = useState(null);
    const [remoteConnected, setRemoteConnected] = useState(false);

    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const callDocRef = useRef(null);
    const unsubscribeRef = useRef(null);
    const timerRef = useRef(null);

    const otherRole = role === "haidar" ? "princess" : "haidar";
    const callDocId = "haizur-call"; // Single call room for both

    // Cleanup function
    const cleanup = useCallback(() => {
        // Stop timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Unsubscribe from Firestore
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        setRemoteConnected(false);
        setCallDuration(0);
    }, []);

    // Delete call document
    const deleteCallDoc = useCallback(async () => {
        try {
            await deleteDoc(doc(firestore, "calls", callDocId));
        } catch (e) {
            console.log("Error deleting call doc:", e);
        }
    }, [callDocId]);

    // End call
    const endCall = useCallback(async () => {
        cleanup();
        await deleteCallDoc();
        setCallStatus("idle");
        setError(null);
    }, [cleanup, deleteCallDoc]);

    // Create peer connection
    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.oniceconnectionstatechange = () => {
            console.log("ICE state:", pc.iceConnectionState);
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                setRemoteConnected(true);
                setCallStatus("connected");
                // Start timer
                if (!timerRef.current) {
                    timerRef.current = setInterval(() => {
                        setCallDuration(prev => prev + 1);
                    }, 1000);
                }
            } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                setRemoteConnected(false);
                if (pc.iceConnectionState === "failed") {
                    setError("Connection failed. Try again.");
                    endCall();
                }
            }
        };

        pc.ontrack = (event) => {
            console.log("Got remote track");
            remoteStreamRef.current = event.streams[0];
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };

        return pc;
    }, [endCall]);

    // Start a call (caller)
    const startCall = useCallback(async () => {
        try {
            setError(null);
            setCallStatus("calling");

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            localStreamRef.current = stream;

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Create call document
            const callDoc = doc(firestore, "calls", callDocId);
            callDocRef.current = callDoc;

            // Collect ICE candidates
            const offerCandidates = [];
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    offerCandidates.push(event.candidate.toJSON());
                    // Update candidates in Firestore
                    updateDoc(callDoc, { offerCandidates });
                }
            };

            // Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Save offer to Firestore
            await setDoc(callDoc, {
                offer: { type: offer.type, sdp: offer.sdp },
                caller: role,
                status: "calling",
                offerCandidates: [],
                answerCandidates: [],
                createdAt: Date.now()
            });

            // Listen for answer
            unsubscribeRef.current = onSnapshot(callDoc, async (snapshot) => {
                const data = snapshot.data();
                if (!data) {
                    // Call was deleted (ended)
                    endCall();
                    return;
                }

                // If answer received
                if (data.answer && !pc.currentRemoteDescription) {
                    const answer = new RTCSessionDescription(data.answer);
                    await pc.setRemoteDescription(answer);
                }

                // Add answer ICE candidates
                if (data.answerCandidates) {
                    data.answerCandidates.forEach(async (candidateData) => {
                        try {
                            const candidate = new RTCIceCandidate(candidateData);
                            await pc.addIceCandidate(candidate);
                        } catch (e) {
                            console.log("Error adding ICE candidate:", e);
                        }
                    });
                }

                // Check if call was declined
                if (data.status === "declined") {
                    setError("Call declined");
                    endCall();
                }
            });

        } catch (err) {
            console.error("Start call error:", err);
            setError(err.message || "Failed to start call");
            setCallStatus("idle");
            cleanup();
        }
    }, [role, callDocId, createPeerConnection, endCall, cleanup]);

    // Answer a call (receiver)
    const answerCall = useCallback(async () => {
        try {
            setError(null);
            setCallStatus("connecting");

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            localStreamRef.current = stream;

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Get call document
            const callDoc = doc(firestore, "calls", callDocId);
            const callSnapshot = await getDoc(callDoc);
            const callData = callSnapshot.data();

            if (!callData || !callData.offer) {
                setError("Call not found");
                setCallStatus("idle");
                cleanup();
                return;
            }

            // Collect ICE candidates
            const answerCandidates = [];
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    answerCandidates.push(event.candidate.toJSON());
                    updateDoc(callDoc, { answerCandidates });
                }
            };

            // Set remote description (offer)
            await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

            // Add offer ICE candidates
            if (callData.offerCandidates) {
                callData.offerCandidates.forEach(async (candidateData) => {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
                    } catch (e) {
                        console.log("Error adding ICE candidate:", e);
                    }
                });
            }

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Save answer to Firestore
            await updateDoc(callDoc, {
                answer: { type: answer.type, sdp: answer.sdp },
                status: "connected"
            });

            // Listen for call end
            unsubscribeRef.current = onSnapshot(callDoc, (snapshot) => {
                if (!snapshot.exists()) {
                    endCall();
                }
            });

        } catch (err) {
            console.error("Answer call error:", err);
            setError(err.message || "Failed to answer call");
            setCallStatus("idle");
            cleanup();
        }
    }, [callDocId, createPeerConnection, endCall, cleanup]);

    // Decline incoming call
    const declineCall = useCallback(async () => {
        try {
            const callDoc = doc(firestore, "calls", callDocId);
            await updateDoc(callDoc, { status: "declined" });
            await deleteDoc(callDoc);
        } catch (e) {
            console.log("Error declining:", e);
        }
        setCallStatus("idle");
    }, [callDocId]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(prev => !prev);
        }
    }, []);

    // Listen for incoming calls
    useEffect(() => {
        if (!role || !isOpen) return;

        const callDoc = doc(firestore, "calls", callDocId);

        const unsub = onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            // If someone is calling and it's not me
            if (data.status === "calling" && data.caller !== role && callStatus === "idle") {
                setCallStatus("incoming");
            }
        });

        return () => unsub();
    }, [role, callDocId, callStatus, isOpen]);

    // Cleanup on unmount or close
    useEffect(() => {
        if (!isOpen) {
            cleanup();
        }
        return () => cleanup();
    }, [isOpen, cleanup]);

    // Format duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
                onClick={(e) => { if (callStatus === "idle") onClose(); }}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Remote audio element */}
                    <audio ref={remoteAudioRef} autoPlay playsInline />

                    {/* Avatar */}
                    <motion.div
                        animate={callStatus === "calling" || callStatus === "incoming" ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center text-5xl"
                        style={{
                            background: callStatus === "connected"
                                ? "linear-gradient(135deg, #22c55e, #16a34a)"
                                : "linear-gradient(135deg, #ec4899, #db2777)"
                        }}
                    >
                        {otherRole === "princess" ? "👸" : "⭐"}
                    </motion.div>

                    {/* Name */}
                    <h2 className="text-xl font-bold text-white mb-2">
                        {otherRole === "princess" ? "Princess" : "Haidar"}
                    </h2>

                    {/* Status */}
                    <p className="text-white/60 text-sm mb-6">
                        {callStatus === "idle" && "Start a voice call"}
                        {callStatus === "calling" && "Calling..."}
                        {callStatus === "incoming" && "Incoming call..."}
                        {callStatus === "connecting" && "Connecting..."}
                        {callStatus === "connected" && (
                            <span className="text-green-400">
                                🔊 {formatDuration(callDuration)}
                            </span>
                        )}
                    </p>

                    {/* Error */}
                    {error && (
                        <p className="text-red-400 text-sm mb-4">{error}</p>
                    )}

                    {/* Connection indicator */}
                    {callStatus === "connected" && (
                        <div className="flex justify-center gap-1 mb-6">
                            {[0, 1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ scaleY: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                    className="w-1 h-6 bg-green-400 rounded-full"
                                />
                            ))}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-center gap-4">
                        {/* Idle state - Start call button */}
                        {callStatus === "idle" && (
                            <>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={startCall}
                                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg"
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    className="w-16 h-16 rounded-full bg-gray-600 hover:bg-gray-700 text-white flex items-center justify-center shadow-lg"
                                >
                                    ✕
                                </motion.button>
                            </>
                        )}

                        {/* Calling state - Cancel button */}
                        {callStatus === "calling" && (
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={endCall}
                                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            </motion.button>
                        )}

                        {/* Incoming call - Accept/Decline */}
                        {callStatus === "incoming" && (
                            <>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={declineCall}
                                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                                >
                                    ✕
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                    onClick={answerCall}
                                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg"
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                </motion.button>
                            </>
                        )}

                        {/* Connected - Mute/End buttons */}
                        {callStatus === "connected" && (
                            <>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={toggleMute}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${isMuted ? "bg-yellow-500" : "bg-gray-600 hover:bg-gray-700"
                                        }`}
                                >
                                    {isMuted ? "🔇" : "🎤"}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={endCall}
                                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                </motion.button>
                            </>
                        )}
                    </div>

                    {/* Hint */}
                    {callStatus === "idle" && (
                        <p className="text-white/40 text-xs mt-6">
                            Make sure you both have the chat open
                        </p>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AudioCall;
