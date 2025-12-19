import { useEffect, useState, useRef, useCallback } from "react";
import { db } from "../firebase";
import { ref, set, onValue } from "firebase/database";
import { generateWords } from "../words";

export const useSession = () => {
  // MODE IS LOCAL ONLY - never synced from Firebase to prevent the bug
  const [localMode, setLocalMode] = useState("typing");

  const [session, setSession] = useState({
    theme: "love",
    timer: 30,
    language: "p1",
    words: generateWords("p1", 100),
    startTime: null,
    gameData: {
      quizSeed: Date.now(),
      memorySeed: Date.now(),
      finishSeed: Date.now(),
      bossHealth: 100,
      bossSeed: Date.now()
    }
  });

  // Combined session with local mode
  const fullSession = { ...session, mode: localMode };

  // Track session ref for callbacks
  const sessionRef = useRef(fullSession);
  useEffect(() => {
    sessionRef.current = fullSession;
  }, [fullSession]);

  useEffect(() => {
    // Safety check - if Firebase isn't available, skip
    if (!db) {
      console.log("Firebase not available");
      return;
    }

    try {
      const dbRef = ref(db, 'session_v1');

      const unsubscribe = onValue(dbRef, (snapshot) => {
        try {
          const data = snapshot.val();

          if (!data) return;

          // Sync everything EXCEPT mode from Firebase
          setSession(prev => ({
            theme: data.theme || prev.theme,
            timer: data.timer || prev.timer,
            language: data.language || prev.language,
            words: data.words || prev.words,
            startTime: data.startTime || prev.startTime,
            gameData: {
              ...prev.gameData,
              ...(data.gameData || {})
            }
          }));

          // Only sync mode if partner explicitly changed it (via mode field update)
          // This happens after the initial load
          if (data.mode && data.modeChangedAt && Date.now() - data.modeChangedAt < 5000) {
            setLocalMode(data.mode);
          }
        } catch (e) {
          console.log("Firebase data parse error:", e);
        }
      }, (error) => {
        console.log("Firebase connection error:", error.message);
      });

      return () => unsubscribe();
    } catch (e) {
      console.log("Firebase setup error:", e);
    }
  }, []);

  const updateSession = useCallback((updates) => {
    const currentSession = sessionRef.current;

    // Handle mode update separately (local first, then broadcast)
    if (updates.mode) {
      setLocalMode(updates.mode);

      // Sync mode to Firebase with timestamp so partner knows it's a fresh change
      if (db) {
        try {
          const dbRef = ref(db, 'session_v1');
          const newSession = {
            ...currentSession,
            ...updates,
            mode: updates.mode,
            modeChangedAt: Date.now(),
            gameData: updates.gameData
              ? { ...currentSession.gameData, ...updates.gameData }
              : currentSession.gameData
          };
          set(dbRef, newSession).catch(console.error);
        } catch (e) {
          console.log("Firebase update error:", e);
        }
      }

      // Also update other session fields if provided
      if (Object.keys(updates).length > 1) {
        const { mode, ...otherUpdates } = updates;
        if (Object.keys(otherUpdates).length > 0) {
          setSession(prev => ({
            ...prev,
            ...otherUpdates,
            gameData: otherUpdates.gameData
              ? { ...prev.gameData, ...otherUpdates.gameData }
              : prev.gameData
          }));
        }
      }
      return;
    }

    // For non-mode updates, update normally
    let newSessionData;
    if (updates.gameData) {
      newSessionData = {
        ...session,
        ...updates,
        gameData: { ...session.gameData, ...updates.gameData }
      };
    } else {
      newSessionData = { ...session, ...updates };
    }

    setSession(newSessionData);

    // Sync to Firebase
    if (db) {
      try {
        const dbRef = ref(db, 'session_v1');
        set(dbRef, { ...newSessionData, mode: localMode }).catch(console.error);
      } catch (e) {
        console.log("Firebase sync error:", e);
      }
    }
  }, [session, localMode]);

  const startNewGame = useCallback((lang = "p1") => {
    const newWords = generateWords(lang, 100);
    updateSession({
      words: newWords,
      language: lang,
      startTime: Date.now()
    });
  }, [updateSession]);

  return { session: fullSession, updateSession, startNewGame };
};