import { api, type BookImportPayload } from "../storage/db";
import { SEED_BOOK, seedWords } from "../../data/seedWords";

export const StudyService = {
  /** 首次运行：本地词书为空时导入内置示例词表 */
  async ensureSeedData(): Promise<void> {
    const books = await api.bookList();
    if (books.length > 0) return;
    const payload: BookImportPayload = { book: SEED_BOOK, words: seedWords() };
    await api.bookImport(payload);
  },

  /** CSV 导入：word,phonetic,pos,释义1;释义2,例句英文,例句中文（带表头可自动跳过） */
  parseCsv(text: string): { words: { word: string; phonetic: string; pos: string; meanings: string[]; examples: { en: string; zh: string }[] }[]; bookName: string } | null {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const splitRow = (row: string): string[] => {
      const out: string[] = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '"') {
          if (inQuote && row[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuote = !inQuote;
        } else if (c === "," && !inQuote) {
          out.push(cur);
          cur = "";
        } else cur += c;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    let start = 0;
    const header = splitRow(lines[0]).map((h) => h.toLowerCase());
    if (header[0] === "word" || header[0] === "单词") start = 1;

    const words: {
      word: string;
      phonetic: string;
      pos: string;
      meanings: string[];
      examples: { en: string; zh: string }[];
    }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = splitRow(lines[i]);
      if (cols.length < 1 || !cols[0]) continue;
      const meanings = (cols[3] ?? "")
        .split(/[;；]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const examples = cols[4] ? [{ en: cols[4], zh: cols[5] ?? "" }] : [];
      words.push({
        word: cols[0],
        phonetic: cols[1] ?? "",
        pos: cols[2] ?? "",
        meanings: meanings.length > 0 ? meanings : ["（未提供释义）"],
        examples,
      });
    }
    return { words, bookName: "" };
  },

  async importCsvAsBook(fileName: string, text: string): Promise<number> {
    const parsed = this.parseCsv(text);
    if (!parsed || parsed.words.length === 0) throw new Error("没有解析到有效数据（需要 CSV：word,phonetic,pos,释义,例句,例句翻译）");
    const bookName = fileName.replace(/\.csv$/i, "") || "导入词书";
    const bookId = `csv-${bookName}`;
    const words = parsed.words.map((w) => ({
      id: `csv-${bookName}-${w.word.toLowerCase()}`,
      bookId,
      word: w.word,
      phonetic: w.phonetic || null,
      pos: w.pos || null,
      meanings: w.meanings,
      examples: w.examples,
      audioUrl: null,
      source: "local",
    }));
    return api.bookImport({
      book: { id: bookId, name: bookName, source: "imported", total: words.length, active: 1 },
      words,
    });
  },

  /** 复习页的本地分类（官方分类不可用时的本地实现，绝不伪装成官方数据） */
  async reviewCategories(): Promise<{
    all: number;
    hard: number;
    favorite: number;
    recentWrong: number;
  }> {
    const books = await api.bookList();
    const active = books.find((b) => b.active === 1);
    if (!active) return { all: 0, hard: 0, favorite: 0, recentWrong: 0 };
    const words = await api.wordList(active.id);
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const records = await api.recordRecent(500);
    const recentWrongIds = new Set(
      records.filter((r) => r.result === "unknown" && r.ts >= weekAgo).map((r) => r.wordId),
    );
    return {
      all: words.filter((w) => w.status !== "new").length,
      hard: words.filter((w) => w.status !== "new" && w.status !== "mastered").length,
      favorite: words.filter((w) => w.favorite).length,
      recentWrong: words.filter((w) => recentWrongIds.has(w.id)).length,
    };
  },
};
