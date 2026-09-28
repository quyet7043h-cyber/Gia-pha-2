import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCalendar } from "@/components/icons";
import * as RomcalModule from "romcal";
import { Vietnam_En } from "@romcal/calendar.vietnam";

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


const CELEBRATION_VI: Record<string, string> = {
  christmas: "Lễ Chúa Giáng Sinh",
  maryMotherOfGod: "Lễ Đức Maria, Mẹ Thiên Chúa",
  epiphany: "Lễ Chúa Hiển Linh",
  baptismOfTheLord: "Lễ Chúa Giêsu Chịu Phép Rửa",
  annunciation: "Lễ Truyền Tin",
  saintJosephSpouseOfTheBlessedVirginMary: "Lễ Thánh Giuse, Bạn Trăm Năm Đức Trinh Nữ Maria",
  saintJosephTheWorker: "Thánh Giuse Thợ",
  immaculateConception: "Lễ Đức Mẹ Vô Nhiễm Nguyên Tội",
  assumption: "Lễ Đức Mẹ Hồn Xác Lên Trời",
  nativityOfTheBlessedVirginMary: "Lễ Sinh Nhật Đức Trinh Nữ Maria",
  immaculateHeartOfMary: "Trái Tim Vô Nhiễm Đức Mẹ Maria",
  sacredHeart: "Lễ Thánh Tâm Chúa Giêsu",
  holyTrinity: "Lễ Chúa Ba Ngôi",
  corpusChristi: "Lễ Mình và Máu Thánh Chúa Kitô",
  ascension: "Lễ Chúa Giêsu Lên Trời",
  pentecost: "Lễ Chúa Thánh Thần Hiện Xuống",
  palmSunday: "Chúa Nhật Lễ Lá",
  holyThursday: "Thứ Năm Tuần Thánh",
  goodFriday: "Thứ Sáu Tuần Thánh",
  holySaturday: "Thứ Bảy Tuần Thánh",
  easterSunday: "Chúa Nhật Phục Sinh",
  divineMercySunday: "Chúa Nhật Lòng Chúa Thương Xót",
  allSaints: "Lễ Các Thánh Nam Nữ",
  allSouls: "Lễ Cầu Cho Các Tín Hữu Đã Qua Đời",
  christTheKing: "Lễ Chúa Giêsu Kitô, Vua Vũ Trụ",
  immaculateHeart: "Trái Tim Vô Nhiễm Đức Mẹ Maria",
  presentationOfTheLord: "Lễ Dâng Chúa Giêsu Trong Đền Thánh",
  transfiguration: "Lễ Chúa Hiển Dung",
  exaltationOfTheHolyCross: "Lễ Suy Tôn Thánh Giá",
  nativityOfSaintJohnTheBaptist: "Lễ Sinh Nhật Thánh Gioan Tẩy Giả",
  saintsPeterAndPaul: "Lễ Thánh Phêrô và Thánh Phaolô Tông Đồ",
  martyrdomOfSaintJohnTheBaptist: "Lễ Thánh Gioan Tẩy Giả Bị Trảm Quyết",
  vietnameseMartyrs: "Lễ Các Thánh Tử Đạo Việt Nam",
};

function celebrationNameVi(day: LiturgicalDay) {
  if (day.key && CELEBRATION_VI[day.key]) return CELEBRATION_VI[day.key];
  const name = day.name ?? "";
  const exact: Record<string, string> = {
    "Christmas": "Lễ Chúa Giáng Sinh",
    "The Epiphany of the Lord": "Lễ Chúa Hiển Linh",
    "The Baptism of the Lord": "Lễ Chúa Giêsu Chịu Phép Rửa",
    "The Annunciation of the Lord": "Lễ Truyền Tin",
    "The Ascension of the Lord": "Lễ Chúa Giêsu Lên Trời",
    "Pentecost Sunday": "Chúa Nhật Chúa Thánh Thần Hiện Xuống",
    "Palm Sunday": "Chúa Nhật Lễ Lá",
    "Easter Sunday": "Chúa Nhật Phục Sinh",
    "Divine Mercy Sunday": "Chúa Nhật Lòng Chúa Thương Xót",
    "The Most Holy Trinity": "Lễ Chúa Ba Ngôi",
    "The Most Holy Body and Blood of Christ": "Lễ Mình và Máu Thánh Chúa Kitô",
    "The Most Sacred Heart of Jesus": "Lễ Thánh Tâm Chúa Giêsu",
    "The Assumption of the Blessed Virgin Mary": "Lễ Đức Mẹ Hồn Xác Lên Trời",
    "The Immaculate Conception of the Blessed Virgin Mary": "Lễ Đức Mẹ Vô Nhiễm Nguyên Tội",
    "All Saints": "Lễ Các Thánh Nam Nữ",
    "All Souls": "Lễ Cầu Cho Các Tín Hữu Đã Qua Đời",
    "Our Lord Jesus Christ, King of the Universe": "Lễ Chúa Giêsu Kitô, Vua Vũ Trụ",
  };
  if (exact[name]) return exact[name];
  return name;
}

function seasonLabel(day?: LiturgicalDay) {
  const raw = day?.seasonNames?.[0] ?? day?.seasons?.[0];
  return raw ? SEASON_LABEL[raw] ?? raw : "Phụng vụ";
}

function typeLabel(day?: LiturgicalDay) {
  return day?.rankName ?? (day?.rank ? TYPE_LABEL[day.rank] ?? day.rank : undefined);
}

function colorLabel(day?: LiturgicalDay) {
  const raw = day?.colors?.[0];
  return raw ? COLOR_LABEL[raw] ?? raw : undefined;
}

const SEASON_LABEL: Record<string, string> = {
  ADVENT: "Mùa Vọng",
  CHRISTMASTIDE: "Mùa Giáng Sinh",
  EARLY_ORDINARY_TIME: "Mùa Thường Niên",
  LATER_ORDINARY_TIME: "Mùa Thường Niên",
  ORDINARY_TIME: "Mùa Thường Niên",
  LENT: "Mùa Chay",
  HOLY_WEEK: "Tuần Thánh",
  EASTER_TRIDUUM: "Tam Nhật Vượt Qua",
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

async function loadVietnameseCalendar(year: number): Promise<CalendarMap> {
  const Romcal = (RomcalModule as any).default ?? (RomcalModule as any).Romcal;
  if (!Romcal) throw new Error("Không tìm thấy thư viện Romcal.");

  const romcal = new Romcal({
    localizedCalendar: Vietnam_En as any,
    scope: "gregorian",
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

            <h3 className="text-lg font-semibold">{celebrationNameVi(celebration)}</h3>

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
