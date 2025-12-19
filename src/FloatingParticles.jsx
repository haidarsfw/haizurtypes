import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function FloatingParticles({ theme }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Only run if theme is 'love' or 'dark' (optional)
    const particleCount = 15;
    const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // Random width %
      y: Math.random() * 100, // Random height %
      size: Math.random() * 20 + 10, // Size between 10px and 30px
      duration: Math.random() * 10 + 10, // Slow float (10-20s)
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  if (theme !== 'love') return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[var(--main-color)]"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            filter: "blur(8px)", // Dreamy blur effect
          }}
          initial={{ y: "110vh", opacity: 0 }}
          animate={{ 
            y: "-10vh", 
            opacity: [0, 0.3, 0] // Fade in then out
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
}