"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { StatsResponse } from "@/types";

/**
 * Admin overview charts (Task 6-a).
 *
 * This module statically imports recharts — it is ONLY loaded through
 * overview-view's React.lazy() so the charting library never enters the
 * initial bundle (BUILD CONTRACT §9). Palette = --chart-1..5 tokens from
 * globals.css (graphite/copper/taupe/terracotta/sand).
 */

type Series = StatsResponse["series"];

const tooltipStyle = {
  borderRadius: "0.75rem",
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
} as const;

function shortLabel(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}...` : label;
}

export function AdminCharts({ series }: { series: Series }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top posts by views</CardTitle>
          <CardDescription>Most-read articles across the blog</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.viewsByPost} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={150}
                  tickFormatter={(v: string) => shortLabel(v, 24)}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="views" name="Views" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top products by clicks</CardTitle>
          <CardDescription>Affiliate outbound clicks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.clicksByProduct} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tickFormatter={(v: string) => shortLabel(v, 24)}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="clicks" name="Clicks" fill="var(--chart-2)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inquiries — last 14 days</CardTitle>
          <CardDescription>New form submissions per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.inquiriesByDay} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Inquiries"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-3)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminCharts;
