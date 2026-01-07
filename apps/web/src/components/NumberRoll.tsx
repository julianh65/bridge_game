import { useEffect, useRef, useState } from "react";

type NumberRollProps = {
  value: number;
  sides?: number;
  durationMs?: number;
  delayMs?: number;
  rollKey?: string | number;
  className?: string;
  label?: string;
};

export const NumberRoll = ({
  value,
  sides = 6,
  durationMs = 900,
  delayMs = 0,
  rollKey,
  className,
  label
}: NumberRollProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isRolling, setIsRolling] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const delayRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (delayRef.current) {
        window.clearTimeout(delayRef.current);
        delayRef.current = null;
      }
    };

    clearTimers();

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || durationMs <= 0 || sides <= 1) {
      setDisplayValue(value);
      setIsRolling(false);
      return clearTimers;
    }

    setIsRolling(true);
    setDisplayValue(1 + Math.floor(Math.random() * sides));
    delayRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        setDisplayValue(1 + Math.floor(Math.random() * sides));
      }, 70);
      timeoutRef.current = window.setTimeout(() => {
        clearTimers();
        setDisplayValue(value);
        setIsRolling(false);
      }, durationMs);
    }, Math.max(0, delayMs));

    return clearTimers;
  }, [value, sides, durationMs, delayMs, rollKey]);

  return (
    <span
      className={`number-roll${isRolling ? " is-rolling" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      role="status"
      aria-live="polite"
    >
      {displayValue}
    </span>
  );
};
