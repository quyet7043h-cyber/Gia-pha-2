import { useEffect, useState } from "react";

import { ImageLightbox, type LightboxImage } from "@/components/ImageLightbox";

/**
 * Bật xem ảnh toàn màn hình dùng chung cho toàn ứng dụng.
 * Bắt sự kiện ở capture phase để cả ảnh nằm trong Link/Button cũng mở
 * lightbox thay vì kích hoạt điều hướng hoặc thao tác của thẻ cha.
 */
export function GlobalImageViewer() {
  const [image, setImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    const onImageClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Không can thiệp vào chính lightbox hoặc những ảnh được chủ động loại trừ.
      if (target.closest('[data-no-lightbox], [role="dialog"]')) return;

      let src = "";
      let caption = "";

      if (target instanceof HTMLImageElement) {
        const rect = target.getBoundingClientRect();
        if (rect.width < 32 || rect.height < 32) return;
        src = target.currentSrc || target.src;
        caption = target.alt || target.getAttribute("aria-label") || "";
      } else if (target instanceof SVGImageElement) {
        const rect = target.getBoundingClientRect();
        if (rect.width < 32 || rect.height < 32) return;
        src =
          target.href?.baseVal ||
          target.getAttribute("href") ||
          target.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
          "";
        const card = target.closest("g");
        caption = card?.querySelector("text")?.textContent?.trim() || "";
      } else {
        return;
      }

      if (!src || src.startsWith("blob:")) return;

      // Chặn Link/Button hoặc handler riêng của thumbnail mở trang khác.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setImage({ src, caption });
    };

    document.addEventListener("click", onImageClick, true);
    return () => document.removeEventListener("click", onImageClick, true);
  }, []);

  if (!image) return null;

  return (
    <ImageLightbox
      images={[image]}
      index={0}
      onIndexChange={() => undefined}
      onClose={() => setImage(null)}
    />
  );
}
