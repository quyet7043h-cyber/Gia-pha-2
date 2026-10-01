import { pdf } from "@react-pdf/renderer";

import { PersonProfileBookPdf } from "@/lib/pdf/PersonProfileBookPdf";
import { getSignedPhotoUrlMap } from "@/lib/photoUpload";
import { getClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";

export async function downloadPersonProfileBookPdf(
  clan: ClanDetail,
): Promise<{ filename: string; bytes: number }> {
  const data = await getClanBookData(clan.id);
  const photoByPersonId = await fetchPhotoDataUris(data.persons);

  const blob = await pdf(
    <PersonProfileBookPdf
      clan={clan}
      data={data}
      photoByPersonId={photoByPersonId}
    />,
  ).toBlob();

  const safe = clan.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `so-gia-pha_${safe}_${today}.pdf`;

  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const base64 = await blobToBase64(blob);
    const saved = await Filesystem.writeFile({
      path: `pdf/${filename}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: filename,
      text: "Sổ gia phả - hồ sơ từng người",
      url: saved.uri,
      dialogTitle: "Chia sẻ / lưu file PDF",
    });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { filename, bytes: blob.size };
}

async function fetchPhotoDataUris(
  persons: { id: string; photo_path: string | null }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const withPhotos = persons.filter(
    (p): p is { id: string; photo_path: string } => !!p.photo_path,
  );
  if (withPhotos.length === 0) return out;

  const urlMap = await getSignedPhotoUrlMap(withPhotos.map((p) => p.photo_path));
  await Promise.all(
    withPhotos.map(async (p) => {
      const url = urlMap.get(p.photo_path);
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        out.set(p.id, await blobToDataUri(await res.blob()));
      } catch {
        // One bad photo must not cancel the whole book export.
      }
    }),
  );
  return out;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => {
      const result = String(fr.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}
