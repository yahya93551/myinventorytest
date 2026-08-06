"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export default function DebouncedDebtSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value || "");

  useEffect(() => {
    setLocal(value || "");
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => onChange(local.trim()), 300);
    return () => clearTimeout(t);
  }, [local, onChange]);

  return (
    <div className="relative w-full">
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search by name or phone"
        className="w-full rounded-lg border border-theme px-3 py-2 pr-12 bg-transparent focus:outline-none focus:ring-2 focus:ring-theme focus:border-theme"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-theme-secondary opacity-80">
        <Search className="w-4 h-4" />
      </span>
    </div>
  );
}
