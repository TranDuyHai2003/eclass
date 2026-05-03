"use client";

import { useEffect, useState, useMemo } from "react";

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isFinished: boolean;
}

export function useCountdown(targetDate: string | Date | null): TimeLeft {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isFinished: false  // ← false by default: null target = not started, not finished
  });

  const target = useMemo(() => {
    if (!targetDate) return null;
    return new Date(targetDate).getTime();
  }, [targetDate]);

  useEffect(() => {
    if (!target) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isFinished: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isFinished: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [target]);

  return timeLeft;
}
