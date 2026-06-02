"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  sizeVariant?: "sm" | "md" | "lg";
}

export default function Input({
  label,
  error,
  helperText,
  icon,
  sizeVariant = "md",
  className = "",
  disabled,
  ...props
}: InputProps) {
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

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-theme-secondary shrink-0">
            {icon}
          </div>
        )}

        <input
          disabled={disabled}
          className={`
            input-base
            ${sizeClasses[sizeVariant]}
            ${icon ? "pl-10" : ""}
            ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : ""}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${className}
          `}
          {...props}
        />
      </div>

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
