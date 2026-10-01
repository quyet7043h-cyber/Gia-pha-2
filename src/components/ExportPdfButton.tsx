import { useMutation } from "@tanstack/react-query";

import { IconDownload } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ClanDetail } from "@/lib/queries/clan-detail";

interface Props {
  clan: ClanDetail;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}

/**
 * Xuất sổ gia phả theo mẫu hồ sơ giấy:
 * mỗi người một trang A4, dữ liệu quan hệ/ảnh được lấy trực tiếp từ
 * dữ liệu gia phả hiện có.
 */
export function ExportPdfButton({ clan, variant = "outline", size }: Props) {
  const m = useMutation({
    mutationFn: async () => {
      const { downloadPersonProfileBookPdf } = await import(
        "@/lib/pdf/exportPersonProfileBook"
      );
      return downloadPersonProfileBookPdf(clan);
    },
  });

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={() => m.mutate()}
        disabled={m.isPending}
      >
        <IconDownload className="h-4 w-4 mr-1.5" />
        {m.isPending ? "Đang xuất PDF…" : "Xuất hồ sơ từng người PDF"}
      </Button>
      {m.error && (
        <p className="text-xs text-destructive">
          {(m.error as Error).message}
        </p>
      )}
    </div>
  );
}
