import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { exportChapterMarkdown } from "../src/chapter-export";

describe("chapter export", () => {
  it("exports safe chapter Markdown and preserves manual text on refresh", async () => {
    const entries = new Map<string, { path: string; extension?: string; content?: string }>();
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
      createFolder: vi.fn(async (path: string) => { entries.set(path, { path }); }),
      create: vi.fn(async (path: string, content: string) => {
        entries.set(path, { path, extension: "md", content });
      }),
      read: vi.fn(async (file: { content?: string }) => file.content ?? ""),
      modify: vi.fn(async (file: { content?: string }, content: string) => { file.content = content; }),
    } as unknown as Vault;
    const sourceFile = {
      path: "Books/Test.epub",
      basename: "Test",
      parent: { path: "Books" },
    } as TFile;
    const doc = document.implementation.createHTMLDocument("chapter");
    doc.body.innerHTML = "<h1>Heading</h1><p>Body text <strong>key point</strong></p><script>alert(1)</script>";

    const path = await exportChapterMarkdown({
      vault,
      sourceFile,
      document: doc,
      sectionIndex: 0,
      chapter: "Chapter 1",
      bookTitle: "Test Book",
      author: "Author",
      vaultName: "Vault",
      highlights: [],
    });
    const exported = entries.get(path)!;
    expect(exported.content).toContain("# Chapter 1");
    expect(exported.content).toContain("Body text **key point**");
    expect(exported.content).not.toContain("alert(1)");

    exported.content += "\nMy chapter summary\n";
    doc.body.innerHTML = "<p>Updated body text</p>";
    await exportChapterMarkdown({
      vault,
      sourceFile,
      document: doc,
      sectionIndex: 0,
      chapter: "Chapter 1",
      bookTitle: "Test Book",
      author: "Author",
      vaultName: "Vault",
      highlights: [],
    });
    expect(exported.content).toContain("Updated body text");
    expect(exported.content).toContain("My chapter summary");
  });
});
