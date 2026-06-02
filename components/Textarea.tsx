"use client";

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  sizeVariant?: "sm" | "md" | "lg";
  rows?: number;
}

export default function Textarea({
  label,
  error,
  helperText,
  sizeVariant = "md",
  rows = 4,
  className = "",
  disabled,
  ...props
}: TextareaProps) {
  const sizeClasses = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-4 py-3.5 text-base",
  };

  return (
    <div className="w-full">
      {label && (
        <label className="text-label mb-2 block">
          {label}
          {props.required && <span className="ml-1 text-red-400">*</span>}
        </label>
      )}

      <textarea
        disabled={disabled}
        rows={rows}
        className={`
          textarea-base
          ${sizeClasses[sizeVariant]}
          ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${className}
        `}
        {...props}
      />

      {error && (
        <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}

      {helperText && !error && (
        <p className="text-theme-secondary text-xs mt-2">{helperText}</p>
      )}
    </div>
  );
}
