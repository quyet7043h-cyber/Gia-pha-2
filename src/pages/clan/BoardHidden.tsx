import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ClanPostCard } from "@/components/ClanPostCard";
import { IconLock, IconUnlock } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { listHiddenPosts } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

/** Quản lý các bài đã ẩn: bài vẫn còn dữ liệu và có thể hiện lại. */
export default function BoardHidden() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();

  if (!isClanAdmin(clan)) {
    return <Navigate to={`/clans/${clanId}/board`} replace />;
  }

  const postsQ = useQuery({
    queryKey: queryKeys.clanPostsHidden(clanId!),
    queryFn: () => listHiddenPosts(clanId!),
    enabled: !!clanId,
    staleTime: 10_000,
    refetchOnMount: "always",
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Bảng tin", to: `/clans/${clanId}/board` },
          { label: "Bài đã ẩn" },
        ]}
      />

      <PageHeader
        icon={<IconLock className="h-7 w-7" />}
        title="Bài đã ẩn"
        description="Các bài đã ẩn vẫn được lưu. Mở bài để Hiện lại hoặc Xóa bài vĩnh viễn."
        actions={
          <Link
            to={`/clans/${clanId}/board`}
            className="h-10 inline-flex items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            ← Quay lại Bảng tin
          </Link>
        }
      />

      {postsQ.isLoading && <p className="text-muted-foreground">Đang tải…</p>}
      {postsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(postsQ.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {!postsQ.isLoading && !postsQ.error && postsQ.data?.length === 0 && (
        <Alert>
          <AlertDescription>
            Không có bài nào đang ẩn.
          </AlertDescription>
        </Alert>
      )}

      <ul className="space-y-2">
        {(postsQ.data ?? []).map((post) => (
          <li key={post.id}>
            <ClanPostCard post={post} clan={clan} />
          </li>
        ))}
      </ul>

      {postsQ.data && postsQ.data.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <IconUnlock className="h-3.5 w-3.5" />
          Bấm vào bài để chọn <strong>Hiện lại</strong> hoặc <strong>Xóa bài</strong>.
        </p>
      )}
    </div>
  );
}
