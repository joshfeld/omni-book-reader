import { afterEach, describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/defaults";
import { ReadingSyncService } from "../src/reading-sync";
import type { ReadingSyncHost } from "../src/reading-sync";
import type { AppliedBookChange } from "../src/reading-sync-model";
import { ReaderDataStore } from "../src/store";
import type { ReaderHighlight } from "../src/types";

const BOOK = "Books/Test Book.epub";
const SYNC_FOLDER = DEFAULT_SETTINGS.syncFolder;

/** In-memory vault shared by simulated devices, standing in for a vault kept in sync by Obsidian Sync. */
class SharedVault {
  readonly files = new Map<string, string>();

  constructor() {
    this.files.set(BOOK, "epub");
  }

  view(): unknown {
    const entry = (path: string): TFile | TFolder | null => {
      if (this.files.has(path)) {
        const file = new TFile();
        file.path = path;
        file.name = path.split("/").pop() ?? path;
        file.extension = file.name.split(".").pop() ?? "";
        const parentPath = path.split("/").slice(0, -1).join("/");
        if (parentPath) {
          file.parent = new TFolder();
          file.parent.path = parentPath;
        }
        return file;
      }
      const prefix = `${path}/`;
      const childPaths = [...this.files.keys()].filter((item) => item.startsWith(prefix) && !item.slice(prefix.length).includes("/"));
      if (!childPaths.length && path !== SYNC_FOLDER) return null;
      const folder = new TFolder();
      folder.path = path;
      folder.children = childPaths.map((item) => entry(item)!).filter(Boolean);
      return folder;
    };
    return {
      getAbstractFileByPath: (path: string) => entry(path),
      read: async (file: TFile) => this.files.get(file.path) ?? "",
      modify: async (file: TFile, data: string) => void this.files.set(file.path, data),
      create: async (path: string, data: string) => void this.files.set(path, data),
      createFolder: async () => undefined,
    };
  }

  syncFiles(): string[] {
    return [...this.files.keys()].filter((path) => path.startsWith(`${SYNC_FOLDER}/`));
  }
}

class SimulatedDevice implements ReadingSyncHost {
  readonly store: ReaderDataStore;
  readonly app: ReadingSyncHost["app"];
  readonly sync: ReadingSyncService;
  readonly applied: AppliedBookChange[] = [];
  private readonly localStorage = new Map<string, unknown>();
  private saved: unknown = null;

  constructor(readonly vault: SharedVault) {
    this.store = new ReaderDataStore({
      loadData: async () => this.saved,
      saveData: async (data) => {
        this.saved = structuredClone(data);
      },
    });
    this.app = {
      vault: vault.view(),
      loadLocalStorage: (key: string) => this.localStorage.get(key) ?? null,
      saveLocalStorage: (key: string, value: unknown) => void this.localStorage.set(key, value),
    } as unknown as ReadingSyncHost["app"];
    this.sync = new ReadingSyncService(this);
  }

  getReaderSettings() {
    return this.store.settings;
  }

  onSyncedBookChanges(changes: AppliedBookChange[]): void {
    this.applied.push(...changes);
  }

  book() {
    return this.store.ensureBook(BOOK, { size: 1, mtime: 1 });
  }

  highlightIds(): string[] {
    return (this.store.getBook(BOOK)?.highlights ?? []).map((item) => item.id).sort();
  }

  /** Delivers the other devices' current sync files, as a file sync service would. */
  receiveAll(): void {
    for (const path of this.vault.syncFiles()) {
      const file = (this.app.vault.getAbstractFileByPath(path));
      if (file) this.sync.handleVaultChange(file);
    }
  }
}

function highlight(id: string): ReaderHighlight {
  return {
    id,
    cfi: "epubcfi(/6/4!/4/2/1:0)",
    text: `Text ${id}`,
    chapter: "Chapter 1",
    color: "yellow",
    style: "highlight",
    tags: [],
    sectionIndex: 1,
    createdAt: 1000,
  };
}

async function settle(device: SimulatedDevice): Promise<void> {
  await device.sync.flush();
}

describe("reading sync service", () => {
  afterEach(() => vi.useRealTimers());

  it("writes one file per device and exchanges highlights between devices", async () => {
    const vault = new SharedVault();
    const desktop = new SimulatedDevice(vault);
    const phone = new SimulatedDevice(vault);
    desktop.book().highlights.push(highlight("a"));
    phone.book().highlights.push(highlight("b"));

    await desktop.sync.start();
    await phone.sync.start();
    desktop.receiveAll();
    await settle(desktop);

    expect(vault.syncFiles()).toHaveLength(2);
    expect(desktop.highlightIds()).toEqual(["a", "b"]);
    expect(phone.highlightIds()).toEqual(["a", "b"]);
    expect(desktop.applied.some((change) => change.addedHighlights.some((item) => item.id === "b"))).toBe(true);
  });

  it("does not treat highlights received from another device as local deletions after a restart", async () => {
    const vault = new SharedVault();
    const desktop = new SimulatedDevice(vault);
    desktop.book().highlights.push(highlight("a"));
    await desktop.sync.start();

    const phone = new SimulatedDevice(vault);
    await phone.sync.start();
    expect(phone.highlightIds()).toEqual(["a"]);

    // The phone is closed while the desktop adds another highlight, then the phone starts again.
    phone.sync.stop();
    desktop.book().highlights.push(highlight("c"));
    desktop.store.markChanged(0);
    await desktop.sync.flush();
    await phone.sync.start();
    desktop.receiveAll();
    await settle(desktop);

    expect(phone.highlightIds()).toEqual(["a", "c"]);
    expect(desktop.highlightIds()).toEqual(["a", "c"]);
  });

  it("propagates a deletion made on one device", async () => {
    const vault = new SharedVault();
    const desktop = new SimulatedDevice(vault);
    const phone = new SimulatedDevice(vault);
    desktop.book().highlights.push(highlight("a"), highlight("b"));
    await desktop.sync.start();
    await phone.sync.start();

    const state = phone.store.getBook(BOOK)!;
    state.highlights = state.highlights.filter((item) => item.id !== "a");
    phone.store.markChanged(0);
    await phone.sync.flush();
    desktop.receiveAll();
    await settle(desktop);

    expect(desktop.highlightIds()).toEqual(["b"]);
  });

  it("does nothing when sync is turned off", async () => {
    const vault = new SharedVault();
    const device = new SimulatedDevice(vault);
    device.store.updateSettings({ syncEnabled: false });
    device.book().highlights.push(highlight("a"));
    await device.sync.start();
    await device.sync.flush();

    expect(device.sync.running).toBe(false);
    expect(vault.syncFiles()).toHaveLength(0);
  });
});
