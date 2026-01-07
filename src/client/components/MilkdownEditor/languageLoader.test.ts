import { describe, it, expect } from "vitest";
import { getAvailableLanguages, findLanguageByName, loadLanguage } from "./languageLoader";

describe("languageLoader", () => {
  describe("getAvailableLanguages", () => {
    it("returns a non-empty array of languages", () => {
      const languages = getAvailableLanguages();
      expect(languages.length).toBeGreaterThan(0);
    });

    it("returns languages with name and alias properties", () => {
      const languages = getAvailableLanguages();
      const firstLang = languages[0];

      expect(firstLang).toHaveProperty("name");
      expect(firstLang).toHaveProperty("alias");
      expect(typeof firstLang.name).toBe("string");
      expect(Array.isArray(firstLang.alias)).toBe(true);
    });

    it("includes common languages like JavaScript, Python, and JSON", () => {
      const languages = getAvailableLanguages();
      const languageNames = languages.map(lang => lang.name);

      expect(languageNames).toContain("JavaScript");
      expect(languageNames).toContain("Python");
      expect(languageNames).toContain("JSON");
    });
  });

  describe("findLanguageByName", () => {
    it("returns null for empty string", () => {
      const result = findLanguageByName("");
      expect(result).toBeNull();
    });

    it("finds language by primary alias", () => {
      const result = findLanguageByName("javascript");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("JavaScript");
    });

    it("finds language by alternative alias", () => {
      // JavaScript has aliases: ["javascript", "js", "jsx"]
      const result = findLanguageByName("js");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("JavaScript");
    });

    it("is case-insensitive", () => {
      const lowerResult = findLanguageByName("json");
      const upperResult = findLanguageByName("JSON");
      const mixedResult = findLanguageByName("Json");

      expect(lowerResult).not.toBeNull();
      expect(upperResult).not.toBeNull();
      expect(mixedResult).not.toBeNull();
      expect(lowerResult?.name).toBe(upperResult?.name);
      expect(lowerResult?.name).toBe(mixedResult?.name);
    });

    it("returns null for unknown language", () => {
      const result = findLanguageByName("nonexistent-language-xyz");
      expect(result).toBeNull();
    });

    it("handles common language aliases correctly", () => {
      // Python
      const python = findLanguageByName("python");
      expect(python?.name).toBe("Python");

      // TypeScript (has "ts" alias)
      const typescript = findLanguageByName("typescript");
      expect(typescript?.name).toBe("TypeScript");

      const ts = findLanguageByName("ts");
      expect(ts?.name).toBe("TypeScript");

      // JSON (has "json5" as another alias)
      const json = findLanguageByName("json");
      expect(json?.name).toBe("JSON");

      const json5 = findLanguageByName("json5");
      expect(json5?.name).toBe("JSON");
    });
  });

  describe("loadLanguage", () => {
    it("returns embedded JSON language support synchronously", async () => {
      const result = await loadLanguage("json");
      expect(result).not.toBeNull();
      expect(result).toBeDefined();
    });

    it("is case-insensitive for JSON", async () => {
      const lowerResult = await loadLanguage("json");
      const upperResult = await loadLanguage("JSON");
      const mixedResult = await loadLanguage("Json");

      expect(lowerResult).not.toBeNull();
      expect(upperResult).not.toBeNull();
      expect(mixedResult).not.toBeNull();
    });

    it("returns null for empty string", async () => {
      const result = await loadLanguage("");
      expect(result).toBeNull();
    });

    it("returns null for unknown language", async () => {
      // Should log warning but not throw
      const result = await loadLanguage("nonexistent-language-xyz");
      expect(result).toBeNull();
    });

    it("loads JavaScript language support via CDN", async () => {
      // This tests lazy-loading from esm.sh
      const result = await loadLanguage("javascript");
      expect(result).not.toBeNull();
      expect(result).toBeDefined();
    }, 10000); // Longer timeout for network request

    it("loads Python language support via CDN", async () => {
      const result = await loadLanguage("python");
      expect(result).not.toBeNull();
      expect(result).toBeDefined();
    }, 10000);
  });
});
