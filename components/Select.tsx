"use client";

import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string | number; label: string }>;
  sizeVariant?: "sm" | "md" | "lg";
}

export default function Select({
  label,
  error,
  helperText,
  options,
  sizeVariant = "md",
  className = "",
  disabled,
  ...props
}: SelectProps) {
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

      <select
        disabled={disabled}
        className={`
          select-base
          ${sizeClasses[sizeVariant]}
          ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${className}
        `}
        {...props}
      >
        <option value="">Select {label?.toLowerCase() || "an option"}...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
