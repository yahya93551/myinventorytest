"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  interactive?: boolean;
  compact?: boolean;
}

export default function Card({
  hover = false,
  interactive = false,
  className = "",
  compact = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl border border-theme bg-theme-card
        backdrop-blur-xl ${compact ? "p-3" : "p-6"} shadow-card
        transition-all duration-200
        ${hover ? "hover:border-slate-600 hover:bg-slate-800/70" : ""}
        ${interactive ? "cursor-pointer hover:shadow-2xl" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
