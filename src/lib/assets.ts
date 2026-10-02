const DB_NAME = "qwen-prompt-studio-assets";
const DB_VERSION = 1;
const STORE = "assets";

export interface ImageAssetRecord {
  id: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  original: Blob;
  preview: Blob;
  createdAt: number;
}

const memory = new Map<string, ImageAssetRecord>();

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

let cachedDb: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open image asset database."));
  });
}

async function getDb(): Promise<IDBDatabase> {
  if (cachedDb) {
    return cachedDb;
  }
  const db = await openDb();
  db.onversionchange = () => {
    db.close();
    cachedDb = null;
  };
  db.onclose = () => {
    cachedDb = null;
  };
  cachedDb = db;
  return db;
}

export function closeDb(): void {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await getDb();
  return await new Promise<T>((resolve, reject) => {
    const tr = db.transaction(STORE, mode);
    const req = fn(tr.objectStore(STORE));
    // Request success does not guarantee the transaction has committed.
    tr.oncomplete = () => resolve(req.result);
    tr.onabort = () => reject(tr.error ?? new Error("Image asset transaction was aborted."));
    tr.onerror = () => reject(tr.error ?? new Error("Image asset database operation failed."));
    req.onerror = () => reject(req.error ?? new Error("Image asset database operation failed."));
  });
}

export async function putImageAsset(record: ImageAssetRecord): Promise<void> {
  if (hasIndexedDb()) await tx("readwrite", (s) => s.put(record));
  memory.set(record.id, record);
}

export async function getImageAsset(id?: string): Promise<ImageAssetRecord | undefined> {
  if (!id) return undefined;
  const cached = memory.get(id);
  if (cached) return cached;
  if (!hasIndexedDb()) return undefined;
  const rec = await tx<ImageAssetRecord | undefined>("readonly", (s) => s.get(id));
  if (rec) memory.set(id, rec);
  return rec;
}

export async function deleteImageAsset(id: string): Promise<void> {
  if (hasIndexedDb()) await tx("readwrite", (s) => s.delete(id));
  memory.delete(id);
}

export async function getAllAssetIds(): Promise<string[]> {
  if (!hasIndexedDb()) return Array.from(memory.keys());
  const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  return keys.map(String);
}

export async function assetBlob(
  id: string,
  kind: "original" | "preview" = "original",
): Promise<Blob | undefined> {
  const r = await getImageAsset(id);
  return r?.[kind];
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("Could not read image asset."));
    fr.readAsDataURL(blob);
  });
}

export async function assetDataUrl(
  id: string,
  kind: "original" | "preview" = "preview",
): Promise<string | undefined> {
  const b = await assetBlob(id, kind);
  return b ? blobToDataUrl(b) : undefined;
}

export async function createPreviewBlob(
  file: File,
  maxDimension = 1024,
): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`Cannot read ${file.name}`));
      i.src = url;
    });
    const k = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not create image preview."))),
        "image/webp",
        0.86,
      ),
    );
    return { blob, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importImageFile(
  file: File,
): Promise<{ assetId: string; width: number; height: number; mimeType: string }> {
  const { blob: preview, width, height } = await createPreviewBlob(file);
  const assetId = crypto.randomUUID();
  await putImageAsset({
    id: assetId,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    width,
    height,
    original: file,
    preview,
    createdAt: Date.now(),
  });
  return { assetId, width, height, mimeType: file.type || "application/octet-stream" };
}

export interface EmbeddedImageAsset {
  id: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  originalDataUrl: string;
  previewDataUrl?: string;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) throw new Error("Invalid embedded image data.");
  const mime = m[1] || "application/octet-stream";
  const raw = m[3] ?? "";
  if (m[2]) {
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(raw)], { type: mime });
}

export async function exportEmbeddedAssets(
  ids: Iterable<string>,
): Promise<Record<string, EmbeddedImageAsset>> {
  const out: Record<string, EmbeddedImageAsset> = {};
  for (const id of new Set(ids)) {
    const r = await getImageAsset(id);
    if (!r) continue;
    out[id] = {
      id,
      filename: r.filename,
      mimeType: r.mimeType,
      width: r.width,
      height: r.height,
      originalDataUrl: await blobToDataUrl(r.original),
      previewDataUrl: await blobToDataUrl(r.preview),
    };
  }
  return out;
}

export async function importEmbeddedAssets(raw: unknown): Promise<number> {
  if (!raw || typeof raw !== "object") return 0;
  let imported = 0;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const x = value as Record<string, unknown>;
    const origUrl = x["originalDataUrl"];
    if (typeof origUrl !== "string") continue;
    const original = await dataUrlToBlob(origUrl);
    const prevUrl = x["previewDataUrl"];
    const preview = typeof prevUrl === "string" ? await dataUrlToBlob(prevUrl) : original;
    const filename = x["filename"];
    const mimeType = x["mimeType"];
    const width = x["width"];
    const height = x["height"];
    await putImageAsset({
      id,
      filename: typeof filename === "string" ? filename : "imported-image",
      mimeType:
        typeof mimeType === "string" ? mimeType : original.type || "application/octet-stream",
      width: Number.isFinite(width) ? Number(width) : 0,
      height: Number.isFinite(height) ? Number(height) : 0,
      original,
      preview,
      createdAt: Date.now(),
    });
    imported++;
  }
  return imported;
}

export async function clearAllAssets(): Promise<void> {
  memory.clear();
  if (!hasIndexedDb()) return;
  await tx("readwrite", (s) => s.clear());
}
