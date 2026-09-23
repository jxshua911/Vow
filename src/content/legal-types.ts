export type LegalBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };
export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };
export const p = (text: string): LegalBlock => ({ type: "p", text });
export const ul = (items: string[]): LegalBlock => ({ type: "ul", items });