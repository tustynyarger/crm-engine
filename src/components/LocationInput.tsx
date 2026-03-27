"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contact } from "@/lib/types";

export function standardizeLocation(value: string): string {
  return value
    .trim()
    .replace(/[_\s]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

type LocationInputProps = {
  autoFocus?: boolean;
  contacts: Contact[];
  excludeContactId?: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  placeholder?: string;
  value: string;
};

export default function LocationInput({
  autoFocus = false,
  contacts,
  excludeContactId,
  onChange,
  onCommit,
  placeholder = "Location",
  value,
}: LocationInputProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const blurTimerRef = useRef<number | null>(null);

  const suggestions = useMemo(() => {
    const normalizedQuery = standardizeLocation(value).toLowerCase();
    const uniqueLocations = new Map<string, string>();

    for (const contact of contacts) {
      const standardized = standardizeLocation(contact.location);
      if (!standardized) {
        continue;
      }

      const key = standardized.toLowerCase();
      if (key === normalizedQuery && contact.id === excludeContactId) {
        continue;
      }

      if (!uniqueLocations.has(key)) {
        uniqueLocations.set(key, standardized);
      }
    }

    return [...uniqueLocations.values()]
      .filter((location) => {
        if (!normalizedQuery) {
          return true;
        }

        return location.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [contacts, excludeContactId, value]);
  const activeIndex = suggestions.length === 0 ? 0 : Math.min(highlightedIndex, suggestions.length - 1);

  function commit(nextValue: string) {
    onCommit(standardizeLocation(nextValue));
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  function clearBlurTimer() {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) {
        return;
      }

      clearBlurTimer();
      closeDropdown();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      clearBlurTimer();
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <input
        autoFocus={autoFocus}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#eb0003] focus:ring-2 focus:ring-[#eb0003]/20"
        onBlur={() => {
          clearBlurTimer();
          blurTimerRef.current = window.setTimeout(() => {
            commit(value);
            closeDropdown();
            blurTimerRef.current = null;
          }, 100);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (suggestions.length > 0) {
              setHighlightedIndex((current) => (current + 1) % suggestions.length);
              setIsOpen(true);
            }
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (suggestions.length > 0) {
              setHighlightedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
              setIsOpen(true);
            }
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            clearBlurTimer();
            closeDropdown();
            commit(suggestions[activeIndex] ?? value);
          }
        }}
        placeholder={placeholder}
        type="text"
        value={value}
      />

      {isOpen && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              className={`block w-full px-3 py-2 text-left text-sm text-slate-700 ${
                index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
              key={suggestion}
              onMouseDown={(event) => {
                event.preventDefault();
                clearBlurTimer();
                closeDropdown();
                commit(suggestion);
              }}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
