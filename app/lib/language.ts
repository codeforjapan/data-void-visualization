import { franc } from "franc-min";

export type LanguageCode = "ja" | "en" | "zh-TW" | "ko";

// franc は ISO 639-3 を返す。繁体・簡体の区別は持たないので、中国語はすべて
// 繁体字（台湾）テンプレートに寄せている。
const FROM_ISO6393: Record<string, LanguageCode> = { jpn: "ja", eng: "en", cmn: "zh-TW", kor: "ko" };

export const LANGUAGE_LABEL: Record<LanguageCode, string> = {
  ja: "日本語",
  en: "英語",
  "zh-TW": "繁体字中国語（台湾）",
  ko: "韓国語",
};

export const SYSTEM_PROMPTS: Record<LanguageCode, string> = {
  ja: "日本語で簡潔に回答し、Web検索結果を根拠として使ってください。",
  en: "Answer concisely in English, and use web search results as your evidence.",
  "zh-TW": "請以繁體中文簡潔回答，並以網路搜尋結果作為依據。",
  ko: "한국어로 간결하게 답변하고, 웹 검색 결과를 근거로 사용해 주세요.",
};

// franc は仮名の有無で日本語を見るので、「自衛隊基地周辺 土地買収 規制」のような
// 漢字だけの日本語は cmn に落ちる。中国語にしか出てこない字（日本の字体と重なるものは
// 入れない）が一つでもあるときだけ中国語と見なし、それ以外は日本語に戻す。
const CHINESE_ONLY = /[們麼這嗎呢妳裡個為從說會對發灣訊夠點兒幾萬與臺國學體樣現實驗们这么个为从说对儿几样现实验车东马鸟长门问间灾讯够吗资报图华汉广关开书见让认语边还进运远连过达]/;

/**
 * 入力文からテンプレート言語を決める。判定不能なら UI の既定言語（日本語）に落とす。
 * CJK は franc が文字種で判定するため短文でも効くので minLength は下げてある。
 */
export function detectLanguage(text: string): LanguageCode {
  const trimmed = text.trim();
  const code = franc(trimmed, { only: Object.keys(FROM_ISO6393), minLength: 1 });
  if (code === "cmn" && !CHINESE_ONLY.test(trimmed)) return "ja";
  return FROM_ISO6393[code] ?? "ja";
}
