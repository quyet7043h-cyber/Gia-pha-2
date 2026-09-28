import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCalendar } from "@/components/icons";

type LiturgicalDay = {
  key?: string;
  name?: string;
  rank?: string;
  rankName?: string;
  colors?: string[];
  seasonNames?: string[];
  seasons?: string[];
  isHolyDayOfObligation?: boolean;
  isOptional?: boolean;
};

type CalendarMap = Record<string, LiturgicalDay[]>;

type RomcalModule = {
  Romcal?: new (options?: Record<string, unknown>) => {
    generateCalendar: (year: number) => Promise<CalendarMap>;
  };
};

const ROMCAL_VERSION = "3.0.0-dev.125";

const SEASON_LABEL: Record<string, string> = {
  ADVENT: "Mùa Vọng",
  CHRISTMASTIDE: "Mùa Giáng Sinh",
  ORDINARY_TIME: "Mùa Thường Niên",
  LENT: "Mùa Chay",
  EASTER_TRIDUUM: "Tam Nhật Vượt Qua",
  EASTER_TITDE: "Mùa Phục Sinh",
  EASTER: "Mùa Phục Sinh",
};

const TYPE_LABEL: Record<string, string> = {
  SOLEMNITY: "Lễ trọng",
  FEAST: "Lễ kính",
  MEMORIAL: "Lễ nhớ",
  OPTIONAL_MEMORIAL: "Lễ nhớ tự do",
  COMMEMORATION: "Kỷ niệm",
};

const COLOR_LABEL: Record<string, string> = {
  GREEN: "Xanh lá",
  WHITE: "Trắng",
  RED: "Đỏ",
  PURPLE: "Tím",
  VIOLET: "Tím",
  ROSE: "Hồng",
  BLACK: "Đen",
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

function seasonLabel(day?: LiturgicalDay) {
  const raw = day?.seasonNames?.[0] ?? day?.seasons?.[0];
  if (!raw) return "Phụng vụ";
  return SEASON_LABEL[raw] ?? raw;
}

function typeLabel(day?: LiturgicalDay) {
  return day?.rankName ?? (day?.rank ? TYPE_LABEL[day.rank] ?? day.rank : undefined);
}

function colorLabel(day?: LiturgicalDay) {
  const raw = day?.colors?.[0];
  return raw ? COLOR_LABEL[raw] ?? raw : undefined;
}

async function loadVietnameseCalendar(year: number): Promise<CalendarMap> {
  // Romcal 3 + lịch riêng cho Việt Nam. Học Giáo Lý cũng đang dùng romcal
  // 3.0.0-dev.125 cho lịch phụng vụ tiếng Việt.
  const [romcalModule, vietnamModule] = await Promise.all([
    import(/* @vite-ignore */ `https://esm.sh/romcal@${ROMCAL_VERSION}`),
    import(
      /* @vite-ignore */
      `https://esm.sh/@romcal/calendar.vietnam@${ROMCAL_VERSION}`
    ),
  ]);

  const RomcalCtor = (romcalModule as RomcalModule).Romcal;
  if (!RomcalCtor) {
    throw new Error("Không tải được Romcal.");
  }

  const vietnamExports = vietnamModule as Record<string, unknown>;
  const localizedCalendar =
    vietnamExports.Vietnam_Vi ??
    vietnamExports.Vietnam ??
    Object.values(vietnamExports).find(
      (value) =>
        value &&
        typeof value === "object" &&
        ("calendar" in value || "locale" in value),
    );

  if (!localizedCalendar) {
    throw new Error("Không tải được lịch Công giáo Việt Nam.");
  }

  const romcal = new RomcalCtor({
    localizedCalendar,
    scope: "gregorian",
    strictMode: true,
  });

  return romcal.generateCalendar(year);
}

export function CatholicDailyCalendar() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [calendar, setCalendar] = useState<CalendarMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = useMemo(() => Number(date.slice(0, 4)), [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadVietnameseCalendar(year)
      .then((result) => {
        if (!cancelled) setCalendar(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCalendar(null);
          setError(
            err instanceof Error
              ? err.message
              : "Không tải được lịch Công giáo Việt Nam.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const celebrations = calendar?.[date] ?? [];
  const celebration = celebrations[0];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5" />
          Lịch Công giáo Việt Nam
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
          <p className="mt-3 text-sm text-muted-foreground">
            Đang tải lịch Công giáo Việt Nam…
          </p>
        ) : error ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {error}
          </div>
        ) : celebration ? (
          <div className="mt-3 space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium">
                {seasonLabel(celebration)}
              </span>

              {typeLabel(celebration) && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {typeLabel(celebration)}
                </span>
              )}

              {colorLabel(celebration) && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  Màu: {colorLabel(celebration)}
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold">{celebration.name}</h3>

            {celebration.isHolyDayOfObligation && (
              <p className="text-sm font-medium text-primary">
                Lễ buộc
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Không có dữ liệu phụng vụ cho ngày này.
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Dữ liệu từ Romcal, sử dụng lịch phụng vụ dành cho Việt Nam và tiếng
          Việt. Đây là lịch tham chiếu; các giáo phận có thể có lễ riêng.
        </p>
      </CardContent>
    </Card>
  );
}
