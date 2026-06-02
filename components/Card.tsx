"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  interactive?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function Card({
  hover = false,
  interactive = false,
  className = "",
  compact = false,
  size = "md",
  children,
  ...props
}: CardProps) {
  const sizeClasses = {
    sm: "card-compact",
    md: "card-standard",
    lg: "card-lg",
  };

  const finalClasses = interactive 
    ? `${sizeClasses[size]} card-interactive` 
    : `${sizeClasses[size]} ${hover ? "hover:shadow-hover hover:bg-theme-surface" : ""}`;

  return (
    <div
      className={`${finalClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
