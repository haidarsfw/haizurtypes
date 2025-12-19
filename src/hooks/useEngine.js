import { useState, useCallback, useEffect, useRef } from "react";
import { generateWords } from "../words";

export const useEngine = () => {
  const [state, setState] = useState("start"); // start, run, finish
  const [words, setWords] = useState("");
  const [typed, setTyped] = useState("");

  // Stats
  const [wpm, setWpm] = useState(0);
  const [rawWpm, setRawWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [history, setHistory] = useState([]); // Array of { time: 1, wpm: 20 }
  const [charStats, setCharStats] = useState({ correct: 0, wrong: 0, extra: 0 });

  // Refs for precise timing
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);

  // Settings
  const [timerDuration, setTimerDuration] = useState(30);
  const [language, setLanguage] = useState("p1");

  const generateNewWords = useCallback(() => {
    const newWords = generateWords(language, 100);
    setWords(newWords);
  }, [language]);

  useEffect(() => {
    generateNewWords();
  }, [generateNewWords]);

  // --- STRICT MATH FUNCTIONS ---
  const calculateResults = (currentTyped, currentWords, timeElapsedSec) => {
    let correct = 0;
    let wrong = 0;
    for (let i = 0; i < currentTyped.length; i++) {
      if (currentTyped[i] === currentWords[i]) correct++;
      else wrong++;
    }

    const timeInMinutes = timeElapsedSec / 60;
    const net = timeInMinutes > 0 ? Math.round((correct / 5) / timeInMinutes) : 0;
    const raw = timeInMinutes > 0 ? Math.round((currentTyped.length / 5) / timeInMinutes) : 0;
    const acc = currentTyped.length > 0 ? Math.round((correct / currentTyped.length) * 100) : 100;

    return { net, raw, acc, stats: { correct, wrong, extra: 0 } };
  };

  // --- GAME LOOP ---
  useEffect(() => {
    if (state === "run") {
      startTimeRef.current = Date.now();
      setHistory([]);

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsedSec = Math.floor((now - startTimeRef.current) / 1000);
        const remaining = timerDuration - elapsedSec;

        if (remaining <= 0) {
          endGame();
          return;
        }

        // We use a functional update here to access the LATEST 'typed' state inside the interval
        setTyped(currentTyped => {
          // Calculate instantaneous stats for the graph
          // Note: In a real app we'd use a ref for 'typed', but this works for the graph snapshot
          // We re-calculate WPM based on total progress so far to smooth the line
          const { net } = calculateResults(currentTyped, words, elapsedSec);

          setHistory(prev => {
            // Only add a point if it's a new second
            if (prev.length > 0 && prev[prev.length - 1].time === elapsedSec) return prev;
            return [...prev, { time: elapsedSec, wpm: net }];
          });
          return currentTyped;
        });

      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [state, timerDuration, words]); // Added words dependency

  const endGame = () => {
    clearInterval(timerRef.current);
    setState("finish");
  };

  // --- KEY HANDLER ---
  const handleKey = useCallback((key) => {
    if (state === "finish") return;

    if (state === "start") {
      setState("run");
    }

    // Play Sound (Simple mechanical click)
    // We will handle the actual audio play in App.jsx to keep hook pure, 
    // or trigger a state toggle here if needed.

    if (key === "Backspace") {
      setTyped((prev) => prev.slice(0, -1));
      return;
    }

    if (!words || typed.length >= words.length) return;

    const newTyped = typed + key;
    setTyped(newTyped);

    // Live UI Updates
    const now = Date.now();
    const elapsedSec = (now - startTimeRef.current) / 1000;
    const { net, raw, acc, stats } = calculateResults(newTyped, words, elapsedSec);

    setWpm(net);
    setRawWpm(raw);
    setAccuracy(acc);
    setCharStats(stats);

  }, [state, typed, words]);

  const restart = () => {
    clearInterval(timerRef.current);
    setState("start");
    setTyped("");
    setWpm(0);
    setRawWpm(0);
    setAccuracy(100);
    setHistory([]);
    // Note: Words are now controlled by session, not generated here
  };

  // Helper to get remaining time for UI
  const getRemainingTime = () => {
    if (state === 'start') return timerDuration;
    if (state === 'finish') return 0;
    const now = Date.now();
    const elapsed = Math.floor((now - startTimeRef.current) / 1000);
    return Math.max(0, timerDuration - elapsed);
  };

  return {
    state, words, typed, timeLeft: getRemainingTime(), wpm, rawWpm, accuracy, charStats, history,
    restart, handleKey, setTimerDuration, setLanguage, language, timerDuration, setState, setWords
  };
};