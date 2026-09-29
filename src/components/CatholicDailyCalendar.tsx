import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCalendar } from "@/components/icons";

type LiturgicalDay = { name: string; rank?: string; color?: string; readings?: string };
type CalendarResponse = { source: string; url: string; text: string; error?: string };

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(value: string, amount: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return isoDate(d);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function parseVietnameseCalendar(text: string, date: string): LiturgicalDay | null {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const heading = `Lịch Công Giáo Tháng ${month} / ${year}`;
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const nextHeading = text.indexOf("\nLịch Công Giáo Tháng ", start + heading.length);
  const section = text.slice(start + heading.length, nextHeading < 0 ? undefined : nextHeading);
  const escapedDay = String(day).padStart(2, "0");
  const match = section.match(new RegExp(`\\n${escapedDay}\\n([\\s\\S]*?)(?=\\n\\d{2}\\n|$)`));
  if (!match) return null;

  const lines = match[1].split("\n").map((x) => x.trim()).filter(Boolean);
  if (!lines.length) return null;
  const colors = new Set(["Xanh", "Trắng", "Đỏ", "Tím", "Hồng", "Đen"]);
  const ranks = new Set(["Lễ trọng", "Lễ kính", "Lễ nhớ", "Lễ vọng"]);
  const readingsIndex = lines.findIndex((x) => x.startsWith("Bài đọc:"));
  const readings = readingsIndex >= 0 ? lines[readingsIndex].replace(/^Bài đọc:\s*/, "") : undefined;
  if (readingsIndex >= 0) lines.splice(readingsIndex, 1);
  const colorIndex = lines.findIndex((x) => colors.has(x));
  const color = colorIndex >= 0 ? lines[colorIndex] : undefined;
  if (colorIndex >= 0) lines.splice(colorIndex, 1);
  const rankIndex = lines.findIndex((x) => ranks.has(x));
  const rank = rankIndex >= 0 ? lines[rankIndex] : undefined;
  if (rankIndex >= 0) lines.splice(rankIndex, 1);
  return { name: lines.join(" "), rank, color, readings };
}

const CATHOLIC_CALENDAR_API = "https://gia-pha-2-quyet7043h-7614s-projects.vercel.app/api/catholic-calendar";

function catholicCalendarApiUrl() {
  // Use the Vercel API directly so both the website and Capacitor APK reach the same JSON endpoint.
  return CATHOLIC_CALENDAR_API;
}

export function CatholicDailyCalendar() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [calendarText, setCalendarText] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("https://tcg24h.com/lich/");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const year = useMemo(() => Number(date.slice(0, 4)), [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(catholicCalendarApiUrl(), { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        const raw = await response.text();
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error(
            `API lịch Công giáo trả về dữ liệu không phải JSON (HTTP ${response.status}).`,
          );
        }
        let data: CalendarResponse;
        try {
          data = JSON.parse(raw) as CalendarResponse;
        } catch {
          throw new Error("API lịch Công giáo trả về JSON không hợp lệ.");
        }
        if (!response.ok || data.error) {
          throw new Error(data.error ?? `Không tải được lịch Công giáo (HTTP ${response.status}).`);
        }
        if (!cancelled) { setCalendarText(data.text); setSourceUrl(data.url); }
      })
      .catch((err: unknown) => {
        if (!cancelled) { setCalendarText(null); setError(err instanceof Error ? err.message : "Không tải được lịch Công giáo Việt Nam."); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  const celebration = calendarText ? parseVietnameseCalendar(calendarText, date) : null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2"><IconCalendar className="h-5 w-5" />Lịch Công giáo Việt Nam</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Ngày trước">←</Button>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-full sm:w-[170px]" />
            <Button type="button" variant="outline" size="sm" onClick={() => setDate((d) => addDays(d, 1))} aria-label="Ngày sau">→</Button>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDate(isoDate(new Date()))}>Hôm nay</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium capitalize">{formatDate(date)}</p>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Đang tải lịch Công giáo Việt Nam…</p>
        ) : error ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</div>
        ) : celebration ? (
          <div className="mt-3 space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              {celebration.rank && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium">{celebration.rank}</span>}
              {celebration.color && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">Màu: {celebration.color}</span>}
            </div>
            <h3 className="text-lg font-semibold">{celebration.name}</h3>
            {celebration.readings && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Bài đọc:</span> {celebration.readings}</p>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nguồn chưa có dữ liệu cho ngày {date.slice(8, 10)}/{date.slice(5, 7)}/{date.slice(0, 4)}.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Nguồn dữ liệu: <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Tin Công Giáo 24h (TCG24H)</a>. Dữ liệu lấy từ lịch phụng vụ tiếng Việt của nguồn.
        </p>
      </CardContent>
    </Card>
  );
}
