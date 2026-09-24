import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
  AnnotationDocumentService,
  buildCfiLink,
  mergeManagedDocument,
  renderHighlightDocument,
  renderNoteDocument,
} from "../src/annotation-documents";
import type { BookState, ReaderHighlight } from "../src/types";

const createdAt = new Date(2026, 6, 19, 12, 0, 0).getTime();

function highlight(overrides: Partial<ReaderHighlight> = {}): ReaderHighlight {
  return {
    id: "highlight-1",
    cfi: "epubcfi(/6/2!/4/2:0)",
    text: "The highlighted source text",
    chapter: "Chapter 1",
    color: "yellow",
    style: "highlight",
    tags: [],
    sectionIndex: 0,
    createdAt,
    ...overrides,
  };
}

describe("annotation documents", () => {
  it("renders separate highlight and note documents in the expected readable format", () => {
    const item = highlight({ note: "My thoughts", noteUpdatedAt: createdAt, tags: ["archetype"] });
    const options = { sourcePath: "Books/Test Book.epub", vaultName: "Test Vault" };
    const highlights = renderHighlightDocument("Test Book", "Test Author", [item], options);
    const notes = renderNoteDocument("Test Book", "Test Author", [item], options);

    expect(highlights).toContain("# Omni Book Reader - Highlights");
    expect(highlights).toContain("### Chapter 1\n\n> The highlighted source text");
    expect(highlights).not.toContain("My thoughts");
    expect(notes).toContain("# Omni Book Reader - Notes");
    expect(notes).toContain("**Note:** My thoughts");
    expect(notes).toContain("Date: 2026-07-19 | Color: #FFD54F | Style: Highlight | Tags: archetype");
    expect(notes).toContain("obsidian://omni-book-reader?sourceVault=");
    expect(notes).not.toMatch(/[?&]vault=/);
  });

  it("preserves manual text outside managed blocks and supports custom templates", () => {
    const generated = renderHighlightDocument("Test Book", "Author", [highlight()], {
      sourcePath: "Books/Test Book.epub",
      vaultName: "Vault",
      customTemplate: "# {{book.title}}\nExported: {{export.date}}\n\n{{entries}}",
      exportedAt: createdAt,
    });
    const first = mergeManagedDocument("# My handwritten summary\n", "highlights", generated);
    const withManualSuffix = `${first}\n## My conclusion\nWill not be overwritten by the plugin\n`;
    const second = mergeManagedDocument(withManualSuffix, "highlights", generated.replace("The highlighted source text", "The updated excerpt"));
    expect(second).toContain("# My handwritten summary");
    expect(second).toContain("The updated excerpt");
    expect(second).toContain("## My conclusion\nWill not be overwritten by the plugin");
    expect(second).not.toContain("The highlighted source text");
    expect(second.match(/omni-book-reader:highlights:start/g)).toHaveLength(1);
    expect(generated).toContain("# Test Book");
    expect(generated).toContain("Exported: 2026-07-19");
    const cfiLink = buildCfiLink("Vault", "Books/Test Book.epub", highlight().cfi);
    expect(cfiLink).toContain("sourceVault=Vault");
    expect(cfiLink).not.toMatch(/[?&]vault=/);
    expect(cfiLink).toContain("cfi=epubcfi%28");
    expect(() => mergeManagedDocument("<!-- omni-book-reader:highlights:start -->\ncorrupted", "highlights", generated))
      .toThrow("managed-block markers in the annotation document are incomplete");
  });

  it("does not resolve a stale custom template path while an internal preset is selected", async () => {
    const entries = new Map<string, { path: string; extension?: string; content?: string }>();
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
      createFolder: vi.fn(async (path: string) => { entries.set(path, { path }); }),
      create: vi.fn(async (path: string, content: string) => {
        entries.set(path, { path, extension: "md", content });
      }),
      modify: vi.fn(),
      cachedRead: vi.fn(),
      getName: vi.fn(() => "Test Vault"),
    } as unknown as Vault;
    const service = new AnnotationDocumentService(vault);
    const state: BookState = {
      sourceSignature: { size: 1, mtime: 1 },
      bookmarks: [],
      highlights: [highlight()],
    };

    await expect(service.sync({
      sourceFile: { path: "Books/Test Book.epub", basename: "Test Book" } as TFile,
      state,
      title: "Test Book",
      author: "Test Author",
      exportTemplate: "classic",
      customExportTemplatePath: "Templates/Deleted.md",
    })).resolves.toBeUndefined();
    expect(vault.cachedRead).not.toHaveBeenCalled();
  });

  it("creates and then maintains one document pair beside the EPUB", async () => {
    const entries = new Map<string, { path: string; extension?: string; content?: string }>();
    const vault = {
      getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
      createFolder: vi.fn(async (path: string) => { entries.set(path, { path }); }),
      create: vi.fn(async (path: string, content: string) => {
        const file = { path, extension: "md", content };
        entries.set(path, file);
        return file;
      }),
      modify: vi.fn(async (file: { path: string; content?: string }, content: string) => {
        file.content = content;
      }),
      cachedRead: vi.fn(async (file: { content?: string }) => file.content ?? ""),
      getName: vi.fn(() => "Test Vault"),
    } as unknown as Vault;
    const state: BookState = {
      sourceSignature: { size: 1, mtime: 1 },
      bookmarks: [],
      highlights: [highlight()],
    };
    const service = new AnnotationDocumentService(vault);
    const sourceFile = {
      path: "Literature notes/Reading notes/Test Book.epub",
      basename: "Test Book",
    } as TFile;

    entries.set("Templates/Export.md", {
      path: "Templates/Export.md",
      extension: "md",
      content: "# {{document.title}}\n\nBook: {{book.title}}\n\n{{entries}}",
    });
    await service.sync({
      sourceFile,
      state,
      title: "Test Book",
      author: "Test Author",
      exportTemplate: "custom",
      customExportTemplatePath: "Templates/Export.md",
    });
    const paths = state.annotationDocuments;
    expect(paths?.highlightPath).toMatch(/^Literature notes\/Reading notes\/Test Book\/Test Book-Highlight-\d{4}-\d{2}-\d{2}\.md$/);
    expect(paths?.notePath).toMatch(/^Literature notes\/Reading notes\/Test Book\/Test Book-Note-\d{4}-\d{2}-\d{2}\.md$/);

    state.highlights[0]!.note = "A note added later";
    await service.sync({
      sourceFile,
      state,
      title: "Test Book",
      author: "Test Author",
      exportTemplate: "custom",
      customExportTemplatePath: "Templates/Export.md",
    });
    await service.sync({
      sourceFile,
      state,
      title: "Test Book",
      author: "Test Author",
      exportTemplate: "custom",
      customExportTemplatePath: "Templates/Export.md",
    });
    expect(vault.create).toHaveBeenCalledTimes(2);
    expect(vault.modify).toHaveBeenCalledTimes(1);
    expect(entries.get(paths!.notePath)?.content).toContain("**Note:** A note added later");
    expect(entries.get(paths!.notePath)?.content).toContain("Book: Test Book");
    expect(entries.get(paths!.highlightPath)?.content).toContain("omni-book-reader:highlights:start");

    const highlightDocument = entries.get(paths!.highlightPath)!;
    highlightDocument.content = highlightDocument.content!.replace("?sourceVault=", "?vault=");
    await service.migrateLegacyProtocolLinks([paths]);
    expect(highlightDocument.content).toContain("?sourceVault=");
    expect(highlightDocument.content).not.toContain("?vault=");
  });
});
