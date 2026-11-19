"use client";

import { useRef, useState, useTransition } from "react";
import { saveProduction } from "@/app/actions";
import { CameraIcon } from "./icons";

// Free, open-source object detection that runs on the phone itself (no photo leaves the phone).
const TFJS = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const COCO = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";

type Det = { bbox: [number, number, number, number]; class: string; score: number };
type Model = { detect: (img: HTMLCanvasElement, max?: number, minScore?: number) => Promise<Det[]> };
declare global { interface Window { cocoSsd?: { load: (o?: { base?: string }) => Promise<Model> } } }

let modelPromise: Promise<Model> | null = null;
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
}
function loadModel() {
  modelPromise ??= (async () => {
    await loadScript(TFJS);
    await loadScript(COCO);
    if (!window.cocoSsd) throw new Error("model missing");
    return window.cocoSsd.load({ base: "lite_mobilenet_v2" });
  })();
  modelPromise.catch(() => { modelPromise = null; });
  return modelPromise;
}

type Item = { id: number; name: string };

export default function CameraCounter({ items, defaultItemId }: { items: Item[]; defaultItemId: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "counting" | "done" | "error">("idle");
  const [detected, setDetected] = useState<number | null>(null);
  const [count, setCount] = useState("");
  const [itemId, setItemId] = useState(defaultItemId ? String(defaultItemId) : "");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setMsg(""); setDetected(null); setCount("");
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const c = canvasRef.current!;
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    try {
      setStatus("loading");
      const model = await loadModel();
      setStatus("counting");
      const dets = (await model.detect(c, 200, 0.3)).filter((d) => d.class === "bottle");
      ctx.lineWidth = Math.max(2, c.width / 250);
      ctx.strokeStyle = "#16a34a"; ctx.fillStyle = "#16a34a"; ctx.font = `bold ${Math.max(14, c.width / 40)}px sans-serif`;
      dets.forEach((d, i) => {
        const [x, y, w, h] = d.bbox;
        ctx.strokeRect(x, y, w, h);
        ctx.fillText(String(i + 1), x + 4, y + Math.max(16, c.width / 40));
      });
      setDetected(dets.length); setCount(String(dets.length)); setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function save(method: "camera" | "manual") {
    const n = Number(count);
    if (!n || n <= 0) { setMsg("Enter how many bottles"); return; }
    start(async () => {
      try {
        await saveProduction({ count: n, detected: method === "camera" ? detected : null, method, itemId: itemId ? Number(itemId) : null });
        setMsg(`Saved ${n} bottles${itemId ? " and added to stock" : ""}.`);
        setDetected(null); setCount(""); setStatus("idle");
        const c = canvasRef.current; if (c) { c.width = 0; c.height = 0; }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="font-semibold">Count with camera</h2>
      <p className="text-xs text-slate-600">Good light, one layer of bottles, all of them in the photo. Always check the number before saving.</p>
      <label className="btn-primary w-full cursor-pointer">
        <CameraIcon className="size-5" /> Take photo of bottles
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>

      <canvas ref={canvasRef} className="w-full rounded-xl" width={0} height={0} aria-label="Photo with counted bottles marked" />
      {status === "loading" && <p className="text-sm text-slate-700" role="status">Getting the counter ready (first time only, about 5 MB)…</p>}
      {status === "counting" && <p className="text-sm text-slate-700" role="status">Counting bottles…</p>}
      {status === "done" && <p className="text-sm font-semibold text-green-700" role="status">Camera counted {detected} bottle{detected === 1 ? "" : "s"}. Fix the number below if needed.</p>}
      {status === "error" && <p className="text-sm text-amber-800" role="alert">The counter couldn&apos;t load (check internet). Type the number below instead.</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prod-count" className="label">Bottles produced</label>
          <input id="prod-count" className="input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <label htmlFor="prod-item" className="label">Add to stock</label>
          <select id="prod-item" className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Don&apos;t add to stock</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" disabled={pending || detected == null} onClick={() => save("camera")}>Save camera count</button>
        <button type="button" className="btn-outline" disabled={pending || !count} onClick={() => save("manual")}>Save typed count</button>
      </div>
      {msg && <p className="text-sm text-slate-700" role="status">{msg}</p>}
    </div>
  );
}
