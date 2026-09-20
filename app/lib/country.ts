// 分類モデルは発信国を ISO 3166-1 alpha-2（JP / GB / TW …）で返す。図の軸ラベルや
// 参照ソース一覧にコードのまま出ると読めないので、表示前にここで日本語の国名に寄せる。
// 国名そのものは Intl に任せ、表記を変えたいものだけ下で上書きする。
const REGION_NAME = new Intl.DisplayNames(["ja"], { type: "region" });

// Intl は US を「アメリカ合衆国」、GB を「イギリス」と読む。プリセットのデータや
// 図のラベルは短い方で揃えている。UK / INT は ISO にないが分類モデルが返すことがある。
const OVERRIDE: Record<string, string> = { US: "米国", GB: "英国", UK: "英国", UN: "国際機関", INT: "国際機関" };

// 分類モデルがコードではなく英語名を返すことがあるので、よく出るものだけ拾う。
const FROM_ENGLISH: Record<string, string> = {
  japan: "JP", "united states": "US", "united states of america": "US", usa: "US",
  "united kingdom": "GB", britain: "GB", england: "GB", china: "CN", taiwan: "TW",
  "hong kong": "HK", "south korea": "KR", "republic of korea": "KR", korea: "KR",
  "north korea": "KP", germany: "DE", france: "FR", italy: "IT", spain: "ES",
  netherlands: "NL", belgium: "BE", switzerland: "CH", austria: "AT", sweden: "SE",
  norway: "NO", denmark: "DK", finland: "FI", poland: "PL", russia: "RU",
  ukraine: "UA", turkey: "TR", israel: "IL", india: "IN", indonesia: "ID",
  thailand: "TH", vietnam: "VN", philippines: "PH", malaysia: "MY", singapore: "SG",
  australia: "AU", "new zealand": "NZ", canada: "CA", mexico: "MX", brazil: "BR",
  "south africa": "ZA", egypt: "EG", "european union": "EU",
  international: "INT", "international organization": "INT",
};

const UNKNOWN = new Set(["", "XX", "ZZ", "N/A", "NA", "NONE", "NULL", "UNKNOWN", "OTHER"]);

/**
 * 分類結果の country を表示用の国名にする。すでに日本語の国名（プリセットのデータや
 * 「国際機関」のような分類）はそのまま通し、コードとして読めないものは「不明」に落とす。
 */
export function countryLabel(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  const upper = trimmed.toUpperCase();
  if (UNKNOWN.has(upper)) return "不明";
  const code = OVERRIDE[upper] ? upper : FROM_ENGLISH[trimmed.toLowerCase()] ?? upper;
  if (OVERRIDE[code]) return OVERRIDE[code];
  if (!/^[A-Z]{2}$/.test(code)) return trimmed;
  try {
    const name = REGION_NAME.of(code);
    // Intl は知らないコードをそのまま返すので、変換できなかったものは不明として扱う。
    return !name || name === code ? "不明" : name;
  } catch {
    return "不明";
  }
}
