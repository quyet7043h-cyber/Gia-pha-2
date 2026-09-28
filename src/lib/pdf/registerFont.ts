import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Register a CJK-capable PDF font once.
 *
 * Be Vietnam Pro covers Vietnamese very well but does not contain Hangul
 * glyphs. Noto Sans CJK KR contains Korean + Latin + Vietnamese glyphs, so
 * using it as the PDF family prevents Korean names from becoming missing
 * characters in exported PDFs.
 *
 * The font is hosted by the official Noto CJK GitHub repository and loaded
 * by react-pdf when the PDF is rendered.
 */
const PDF_CJK_FONT_URL =
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf";

export function ensurePdfFontRegistered(): void {
  if (registered) return;

  Font.register({
    family: "NotoSansCJKkr",
    fonts: [
      { src: PDF_CJK_FONT_URL, fontWeight: 400 },
      // Reuse the same CJK font for bold weights. This is intentional:
      // fontkit/react-pdf can synthesize the requested weight while keeping
      // the complete Hangul glyph coverage.
      { src: PDF_CJK_FONT_URL, fontWeight: 600 },
      { src: PDF_CJK_FONT_URL, fontWeight: 700 },
    ],
  });

  // Disable hyphenation — names and Vietnamese words should not break
  // unexpectedly in the middle of a word.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}

export const PDF_FONT_FAMILY = "NotoSansCJKkr";
