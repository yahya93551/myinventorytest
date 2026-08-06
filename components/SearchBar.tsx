"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export default function SearchBar({
  search,
  setSearch,
}: {
  search: string;
  setSearch: (v: string) => void;
}) {
  const [local, setLocal] = useState(search);

  useEffect(() => {
    setLocal(search);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(local.trim()), 300);
    return () => clearTimeout(t);
  }, [local, setSearch]);

  const clear = () => {
    setLocal("");
    setSearch("");
  };

  return (
    <div className="relative w-full">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary">
        <Search size={18} />
      </div>
      <input
        type="text"
        placeholder="Search products..."
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="w-full pl-10 pr-10 py-3 rounded-xl bg-theme-input border border-theme text-theme-primary placeholder-theme-secondary focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
      />
      {local && (
        <button
          onClick={clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}