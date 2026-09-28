import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCalendar } from "@/components/icons";

type Celebration = {
  name?: string;
  type?: string;
  quote?: string;
  description?: string;
};

type ApiResponse = {
  date: string;
  season?: string;
  celebration?: Celebration;
};

const API_BASE =
  "https://cpbjr.github.io/catholic-readings-api/liturgical-calendar";

const SEASON_LABEL: Record<string, string> = {
  "Ordinary Time": "Mùa Thường Niên",
  Lent: "Mùa Chay",
  Easter: "Mùa Phục Sinh",
  Advent: "Mùa Vọng",
  Christmas: "Mùa Giáng Sinh",
};

const TYPE_LABEL: Record<string, string> = {
  SOLEMNITY: "Lễ trọng",
  FEAST: "Lễ kính",
  MEMORIAL: "Lễ nhớ",
  OPTIONAL_MEMORIAL: "Lễ nhớ tự do",
  COMMEMORATION: "Kỷ niệm",
};

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
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function CatholicDailyCalendar() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const [year, month, day] = date.split("-");
    return `${API_BASE}/${year}/${month}-${day}.json`;
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error
              ? "Không tải được lịch Công giáo cho ngày này."
              : "Không tải được lịch Công giáo.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const celebration = data?.celebration;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5" />
          Lịch Công giáo theo ngày
        </CardTitle>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="Ngày trước"
            >
              ←
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full sm:w-[170px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="Ngày sau"
            >
              →
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDate(isoDate(new Date()))}
          >
            Hôm nay
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm font-medium capitalize">{formatDate(date)}</p>

        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Đang tải lịch…</p>
        ) : error ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {error}
          </div>
        ) : celebration ? (
          <div className="mt-3 space-y-2 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium">
                {SEASON_LABEL[data?.season ?? ""] ?? data?.season ?? "Phụng vụ"}
              </span>
              {celebration.type && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {TYPE_LABEL[celebration.type] ?? celebration.type}
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold">{celebration.name}</h3>

            {celebration.description && (
              <p className="text-sm text-muted-foreground">
                {celebration.description}
              </p>
            )}

            {celebration.quote && (
              <p className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                {celebration.quote}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Không có dữ liệu lễ mừng cho ngày này.
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Dữ liệu lịch phụng vụ được lấy từ Catholic Readings API. Có thể bổ
          sung nguồn lịch riêng của từng giáo phận Việt Nam ở bước tiếp theo.
        </p>
      </CardContent>
    </Card>
  );
}
