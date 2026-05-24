"use client";

import React, { useEffect, useState } from "react";
import Card from "./Card";
import Button from "./Button";
import { apiGet } from "@/lib/apiClient";

interface ActivityLogEntry {
  id: string;
  tenant_id: string;
  performed_by: string;
  action: string;
  entity: string;
  entity_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  http_method?: string;
  endpoint?: string;
  status_code?: number;
  created_at: string;
}

interface ActivityLogProps {
  page?: number;
  perPage?: number;
  action?: string;
  entity?: string;
  performedBy?: string;
}

const actionColors: Record<string, string> = {
  CREATE: "bg-green-500/20 text-green-400 border-green-500/30",
  SELL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  LOAD: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  RESTOCK: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  BULK_CREATE: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
  UPDATE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  LOGIN: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  LOGOUT: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const entityIcons: Record<string, string> = {
  product: "📦",
  sale: "💰",
  user: "👤",
  settings: "⚙️",
  category: "📂",
  default: "📋",
};

export default function ActivityLog({
  page = 1,
  perPage = 20,
  action,
  entity,
  performedBy,
}: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);

  const fetchActivities = async (pageNum: number) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        per_page: perPage.toString(),
      });

      if (action) params.append("action", action);
      if (entity) params.append("entity", entity);
      if (performedBy) params.append("performed_by", performedBy);

      const result = await apiGet<{ activities: ActivityLogEntry[]; count: number }>(
        `/api/activity?${params.toString()}`
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch activity logs");
      }

      setActivities(result.data?.activities || []);
      setTotalCount(result.data?.count || 0);
      setCurrentPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(1);
  }, [action, entity, performedBy, perPage]);

  const getActionColor = (act: string): string => {
    return actionColors[act] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const getEntityIcon = (ent: string): string => {
    return entityIcons[ent] || entityIcons.default;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than a minute
    if (diff < 60000) return "just now";
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // Less than a week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-theme-secondary">Loading activities...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <div className="text-red-400">Error: {error}</div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchActivities(currentPage)}
          className="mt-3"
        >
          Retry
        </Button>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-theme-secondary">No activity yet</p>
      </Card>
    );
  }

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <Card key={activity.id} className="p-4 hover" interactive>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="text-2xl mt-1">{getEntityIcon(activity.entity)}</div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium border ${getActionColor(
                      activity.action
                    )}`}
                  >
                    {activity.action}
                  </span>
                  <span className="text-theme-secondary text-sm">
                    on <span className="font-semibold text-theme">{activity.entity}</span>
                  </span>
                </div>

                {activity.details && (
                  <div className="text-sm text-theme-secondary mb-2 space-y-1">
                    {activity.details.productName && (
                      <p>Product: <span className="text-theme">{activity.details.productName}</span></p>
                    )}
                    {activity.details.orderId && (
                      <p>Order: <span className="text-theme">{activity.details.orderId}</span></p>
                    )}
                    {activity.details.quantity != null && (
                      <p>Quantity: <span className="text-theme font-semibold">{activity.details.quantity}</span></p>
                    )}
                    {activity.details.totalQuantity != null && (
                      <p>Total quantity: <span className="text-theme font-semibold">{activity.details.totalQuantity}</span></p>
                    )}
                    {activity.details.itemCount != null && (
                      <p>Line items: <span className="text-theme font-semibold">{activity.details.itemCount}</span></p>
                    )}
                    {activity.details.name && activity.action === "CREATE" && (
                      <p>Created: <span className="text-theme">{activity.details.name}</span></p>
                    )}
                    {activity.action === "DELETE" && activity.entity_id && (
                      <p>Deleted ID: <span className="text-theme font-mono text-xs">{activity.entity_id.slice(0, 8)}...</span></p>
                    )}
                  </div>
                )}

                <div className="text-xs text-theme-secondary space-x-3">
                  <span>{formatDate(activity.created_at)}</span>
                  <span>•</span>
                  <span>
                    By: <span className="font-semibold text-theme">{(activity as any).performed_by_email || activity.performed_by}</span>
                  </span>
                  {activity.ip_address && activity.ip_address !== "unknown" && (
                    <span title={activity.ip_address}>IP: {activity.ip_address}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              {activity.status_code && (
                <div
                  className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                    activity.status_code >= 200 && activity.status_code < 300
                      ? "text-green-400"
                      : activity.status_code >= 400
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {activity.status_code}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => fetchActivities(currentPage - 1)}
          >
            ← Prev
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => fetchActivities(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => fetchActivities(currentPage + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
