"use client";

import React, { useRef, useState } from "react";
import { apiPost } from "@/lib/apiClient";
import Card from "./Card";
import Button from "./Button";

interface BulkUploadProduct {
  name: string;
  category: string;
  cost_price?: number;
  price?: number;
  stock?: number;
  custom_data?: Record<string, any>;
}

interface UploadResult {
  success: boolean;
  partialSuccess?: boolean;
  inserted: number;
  total: number;
  products?: BulkUploadProduct[];
  errors?: Array<{ index: number; name: string; error: string }>;
  message: string;
}

export default function BulkUploadProducts() {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [preview, setPreview] = useState<BulkUploadProduct[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const parseJsonFile = (content: string): BulkUploadProduct[] => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.products && Array.isArray(parsed.products)) {
        return parsed.products;
      } else {
        throw new Error("JSON must be an array of products or have a 'products' array");
      }
    } catch (err) {
      throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const parseCsvFile = (content: string): BulkUploadProduct[] => {
    const lines = content.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one product");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const products: BulkUploadProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(",").map((v) => v.trim());
      const product: BulkUploadProduct = {
        name: "",
        category: "",
      };

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j];

        if (header === "name") product.name = value;
        else if (header === "category") product.category = value;
        else if (header === "price") product.price = parseFloat(value) || 0;
        else if (header === "cost_price") product.cost_price = parseFloat(value) || 0;
        else if (header === "stock") product.stock = parseInt(value, 10) || 0;
      }

      if (!product.name || !product.category) {
        throw new Error(
          `Row ${i + 1} missing required fields (name, category)`
        );
      }

      products.push(product);
    }

    return products;
  };

  const handleFileProcessing = async (file: File) => {
    setError(null);
    setResult(null);
    setPreview([]);
    setShowPreview(false);

    try {
      const content = await file.text();
      let products: BulkUploadProduct[] = [];

      if (file.name.endsWith(".json")) {
        products = parseJsonFile(content);
      } else if (file.name.endsWith(".csv")) {
        products = parseCsvFile(content);
      } else {
        throw new Error("File must be JSON or CSV");
      }

      if (products.length === 0) {
        throw new Error("No products found in file");
      }

      if (products.length > 1000) {
        throw new Error("Maximum 1000 products allowed per upload");
      }

      setPreview(products);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileProcessing(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFileProcessing(files[0]);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const result = await apiPost<{
        success: boolean;
        partialSuccess?: boolean;
        inserted: number;
        total: number;
        products?: BulkUploadProduct[];
        errors?: Array<{ index: number; name: string; error: string }>;
        message: string;
      }>("/api/bulk/upload", { products: preview });

      if (!result.success || !result.data) {
        setError(result.error || "Upload failed");
        return;
      }

      setResult(result.data);
      setPreview([]);
      setShowPreview(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Success/Error Messages */}
      {result && (
        <Card
          className={
            result.success
              ? "border-green-500/30 bg-green-500/5"
              : "border-yellow-500/30 bg-yellow-500/5"
          }
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">
              {result.success ? "✅" : "⚠️"}
            </div>
            <div className="flex-1">
              <p className={result.success ? "text-green-400" : "text-yellow-400"}>
                {result.message}
              </p>
              <p className="text-sm text-theme-secondary mt-1">
                {result.inserted} of {result.total} products inserted
              </p>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-sm font-semibold text-red-400">Failed items:</p>
                  {result.errors.map((err) => (
                    <p key={`${err.index}-${err.name}`} className="text-xs text-red-300">
                      Row {err.index} ({err.name}): {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResult(null)}
            className="mt-3"
          >
            Upload More
          </Button>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">❌</div>
            <div className="flex-1">
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Preview */}
      {showPreview && preview.length > 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <div className="mb-4">
            <p className="text-blue-400 font-semibold mb-2">
              📋 Preview: {preview.length} product(s) ready to upload
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {preview.slice(0, 10).map((product, idx) => (
                <div
                  key={idx}
                  className="text-sm text-theme-secondary bg-theme/50 p-2 rounded border border-theme"
                >
                  <span className="font-semibold text-theme">{product.name}</span>
                  <span className="text-xs ml-2">({product.category})</span>
                  {product.price ? (
                    <span className="text-xs ml-2 text-green-400">
                      ${product.price}
                    </span>
                  ) : null}
                </div>
              ))}
              {preview.length > 10 && (
                <p className="text-xs text-theme-secondary text-center py-2">
                  ... and {preview.length - 10} more
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              loading={loading}
              disabled={loading}
            >
              {loading ? "Uploading..." : "✓ Upload Products"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPreview(false);
                setPreview([]);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Upload Area */}
      {!showPreview && result === null && (
        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging
              ? "border-cyan-400 bg-cyan-500/10"
              : "border-theme hover:border-cyan-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📁</div>

            <h3 className="text-lg font-semibold text-theme mb-2">
              Drag & Drop File Here
            </h3>

            <p className="text-theme-secondary mb-4">
              or click to select a JSON or CSV file
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Select File
            </Button>

            {/* Format Examples */}
            <div className="mt-6 space-y-3 text-left text-xs text-theme-secondary">
              <div>
                <p className="font-semibold text-theme mb-1">JSON Format:</p>
                <code className="block bg-theme/30 p-2 rounded font-mono text-xs overflow-x-auto">
{`[
  {
    "name": "Product 1",
    "category": "Electronics",
    "price": 99.99,
    "cost_price": 50,
    "stock": 100
  }
]`}
                </code>
              </div>

              <div>
                <p className="font-semibold text-theme mb-1">CSV Format:</p>
                <code className="block bg-theme/30 p-2 rounded font-mono text-xs overflow-x-auto">
                  name,category,price,cost_price,stock
                  <br />
                  Product 1,Electronics,99.99,50,100
                </code>
              </div>

              <div>
                <p className="font-semibold text-theme mb-1">ℹ️ Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Maximum 1000 products per file</li>
                  <li>name and category are required</li>
                  <li>price, cost_price, stock are optional</li>
                  <li>Supports bulk creation with fallback on errors</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
