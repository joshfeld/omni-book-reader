import { normalizePath } from "obsidian";
import type { TAbstractFile, TFile, Vault } from "obsidian";

function isFile(value: TAbstractFile | null): value is TFile {
  return Boolean(value && "extension" in value);
}

export function safeFileName(value: string, fallback = "Untitled"): string {
  const result = Array.from(value, (character) => character.charCodeAt(0) < 32 ? "-" : character)
    .join("")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (result || fallback).slice(0, 120);
}

export async function ensureVaultFolder(vault: Vault, path: string): Promise<void> {
  let current = "";
  for (const part of normalizePath(path).split("/").filter(Boolean)) {
    current = normalizePath([current, part].filter(Boolean).join("/"));
    const existing = vault.getAbstractFileByPath(current);
    if (isFile(existing)) throw new Error(`Could not create the folder because a file already exists at: ${current}`);
    if (!existing) await vault.createFolder(current);
  }
}

export async function sourceToBlob(source: string): Promise<Blob> {
  if (!source.startsWith("blob:") && !source.startsWith("data:")) {
    throw new Error("Only images embedded in the book (blob: or data: URLs) can be read.");
  }
  return readLocalBlob(source);
}

function readLocalBlob(source: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", source);
    request.responseType = "blob";
    request.onload = () => request.status === 0 || (request.status >= 200 && request.status < 300)
      ? resolve(request.response as Blob)
      : reject(new Error(`Could not read the image (${request.status})`));
    request.onerror = () => reject(new Error("Could not read the image"));
    request.send();
  });
}

export function extensionForBlob(blob: Blob, source = ""): string {
  const byType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  const known = byType[blob.type.toLowerCase()];
  if (known) return known;
  const match = source.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
  return match?.[1]?.toLowerCase() ?? "png";
}

export async function saveBlobToVault(vault: Vault, path: string, blob: Blob): Promise<void> {
  await ensureVaultFolder(vault, path.split("/").slice(0, -1).join("/"));
  const existing = vault.getAbstractFileByPath(path);
  const data = await blob.arrayBuffer();
  if (isFile(existing)) await vault.modifyBinary(existing, data);
  else if (existing) throw new Error(`The image destination path is not a file: ${path}`);
  else await vault.createBinary(path, data);
}
