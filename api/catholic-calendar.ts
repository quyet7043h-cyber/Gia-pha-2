export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const response = await fetch("https://tcg24h.com/lich/", {
      headers: { "user-agent": "Gia-pha-2 Catholic Calendar/1.0" },
    });
    if (!response.ok) {
      res.status(response.status).json({ error: "Không tải được lịch Công giáo từ TCG24H." });
      return;
    }
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/gi, "'")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json({ source: "TCG24H", url: "https://tcg24h.com/lich/", text });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Không thể lấy dữ liệu lịch Công giáo." });
  }
}