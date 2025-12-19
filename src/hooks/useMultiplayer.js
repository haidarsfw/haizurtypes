import { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, set, onValue, onDisconnect, remove } from "firebase/database";

// Accepts 'gameData' to broadcast specific game stats (like wpm, typed index)
export const useMultiplayer = (activeGame, gameData = {}) => {
  const [users, setUsers] = useState({});
  const myId = useRef(Math.random().toString(36).substr(2, 9));
  
  const isPrincess = new URLSearchParams(window.location.search).get("princess") === "true";
  const myRole = isPrincess ? "princess" : "prince";

  useEffect(() => {
    if (!db) return;
    const userRef = ref(db, `users/${myId.current}`);

    // Update DB whenever mouse moves OR gameData changes
    const updateDB = (x, y) => {
      set(userRef, {
        x, y, 
        role: myRole, 
        status: activeGame || "menu",
        gameData: gameData, // <--- SENDING LIVE STATS (WPM, Progress)
        lastSeen: Date.now(),
        online: true
      });
    };

    // Initial set
    updateDB(50, 50);
    onDisconnect(userRef).remove();

    // Listen for others
    const allUsersRef = ref(db, 'users');
    const unsubscribe = onValue(allUsersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const now = Date.now();
      const others = {};

      Object.keys(data).forEach(key => {
        const isRecent = (now - data[key].lastSeen) < 60000;
        if (key !== myId.current && isRecent) {
            others[key] = data[key];
        } else if (!isRecent && key !== myId.current) {
            remove(ref(db, `users/${key}`)); 
        }
      });
      setUsers(others);
    });

    let lastX = 50, lastY = 50;
    let lastUpdate = 0;

    const handleMouseMove = (e) => {
      const now = Date.now();
      if (now - lastUpdate > 50) { 
          lastX = (e.clientX / window.innerWidth) * 100;
          lastY = (e.clientY / window.innerHeight) * 100;
          updateDB(lastX, lastY);
          lastUpdate = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      remove(userRef);
      unsubscribe();
    };
  }, [activeGame, myRole, JSON.stringify(gameData)]); // Re-run when gameData changes

  return users;
};