"use client";

import { useMemo, useState } from "react";
import { addDays, toDateInputValue } from "@/lib/date";

interface DoneFollowUpModalProps {
  name: string;
  onCancel: () => void;
  onSave: (nextFollowUp: Date | null, noteText: string) => void;
}

type FollowUpOption = "1" | "3" | "7" | "custom";

export function DoneFollowUpModal({ name, onCancel, onSave }: DoneFollowUpModalProps) {
  const [option, setOption] = useState<FollowUpOption | null>(null);
  const [customDate, setCustomDate] = useState(toDateInputValue(addDays(new Date(), 7)));
  const [noteText, setNoteText] = useState("");

  const computedDate = useMemo(() => {
    if (!option) {
      return null;
    }

    if (option === "custom") {
      return new Date(`${customDate}T09:00:00`);
    }

    const days = Number(option);
    return addDays(new Date(), days);
  }, [customDate, option]);

  function handleSave() {
    if (computedDate && Number.isNaN(computedDate.getTime())) {
      return;
    }

    onSave(computedDate, noteText.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-sm sm:items-center">
      <div className="crm-fade-up w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Mark follow-up done</h3>
        <p className="mt-1 text-sm text-slate-600">{name}</p>
        <p className="mt-1 text-xs text-slate-500">
          Leave blank to use the smart default follow-up.
        </p>

        <fieldset className="mt-4 grid grid-cols-2 gap-2">
          {[
            { value: "1", label: "1 day" },
            { value: "3", label: "3 days" },
            { value: "7", label: "7 days" },
            { value: "custom", label: "Custom" },
          ].map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-2 text-sm hover:bg-slate-50"
            >
              <input
                checked={option === item.value}
                onChange={() => setOption(item.value as FollowUpOption)}
                type="radio"
              />
              {item.label}
            </label>
          ))}
        </fieldset>

        {option === "custom" && (
          <div className="mt-3">
            <label className="text-sm text-slate-700" htmlFor="custom-date">
              Next follow-up date
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              id="custom-date"
              onChange={(event) => setCustomDate(event.target.value)}
              type="date"
              value={customDate}
            />
          </div>
        )}

        <div className="mt-3">
          <label className="text-sm text-slate-700" htmlFor="quick-note">
            Quick note (optional)
          </label>
          <textarea
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            id="quick-note"
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Conversation summary"
            value={noteText}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            onClick={handleSave}
            type="button"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
