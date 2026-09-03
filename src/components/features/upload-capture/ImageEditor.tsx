import React, { useEffect, useRef, useState } from "react";
import {
  Crop,
  Type,
  Pencil,
  EyeOff,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Undo,
  Redo,
  Save,
  Trash2,
  MousePointer,
  Check,
  X,
  Sliders,
  Square,
  Circle as CircleIcon,
  Minus,
  MoveRight,
  Download,
  ChevronDown
} from "lucide-react";

// --- Types ---
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

type FreehandStroke = {
  id: string;
  kind: "draw";
  points: Point[];
  color: string;
  width: number;
};

type TextItem = {
  id: string;
  kind: "text";
  box: Box;
  text: string;
  color: string;
  font: string;
  size: number;
};

type BlurType = "gaussian" | "box" | "median";

type BlurItem = {
  id: string;
  kind: "blur";
  box: Box;
  blurType: BlurType;
  intensity: number;
};

type ShapeType = "rect" | "circle" | "line" | "arrow";

type ShapeItem = {
  id: string;
  kind: "shape";
  shapeType: ShapeType;
  box: Box;
  color: string;
  strokeWidth: number;
  isFilled: boolean;
};

type Item = FreehandStroke | TextItem | BlurItem | ShapeItem;
type CropHandle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type HistoryFrame = {
  items: Item[];
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  imageSrc: string;
};

const uid = () => crypto.randomUUID();
const colors = ["#0857C3", "#06449B", "#71C5E8", "#0F172A", "#ef4444", "#22c55e", "#f59e0b", "#ffffff"];
const fonts = ["Arial", "Inter", "Verdana", "Georgia", "Courier New"];
const clone = <T,>(value: T): T => structuredClone(value);

export default function ImageEditorView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const dragRef = useRef<{
    start: Point;
    mode: "move" | "resize" | "draw" | "crop";
    activeId?: string;
    cropHandle?: CropHandle;
  } | null>(null);

  // --- Image & Canvas States ---
  const [source, setSource] = useState<{ id: string; url: string; mimeType: string }>();
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // --- Object States & History ---
  const [items, setItems] = useState<Item[]>([]);
  const [past, setPast] = useState<HistoryFrame[]>([]);
  const [future, setFuture] = useState<HistoryFrame[]>([]);

  // --- Active Tools ---
  const [tool, setTool] = useState<"select" | "draw" | "text" | "blur" | "crop" | "shape">("select");
  const [activeShape, setActiveShape] = useState<ShapeType>("rect");
  const [isShapeFilled, setIsShapeFilled] = useState<boolean>(false);
  const [color, setColor] = useState(colors[0]);
  const [brushWidth, setBrushWidth] = useState(4);
  const [font, setFont] = useState(fonts[0]);
  const [fontSize, setFontSize] = useState(32);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  // Local Export State & Dropdown Toggle
  const [exportQuality] = useState<number>(0.92);
  const [showLocalDropdown, setShowLocalDropdown] = useState<boolean>(false);

  // Blur Settings
  const [blurType, setBlurType] = useState<BlurType>("gaussian");
  const [blurRadius, setBlurRadius] = useState(10);

  // Crop State
  const [cropBox, setCropBox] = useState<Box | null>(null);
  const [cropMode, setCropMode] = useState(false);

  // Text Inline Editor State
  const [editingText, setEditingText] = useState<{ id?: string; x: number; y: number; text: string } | null>(null);

  // Save State to History Stack
  const commitState = (nextItems: Item[]) => {
    setPast((prev) => [
      ...prev,
      {
        items: clone(items),
        rotation,
        flipH,
        flipV,
        imageSrc: imageRef.current?.src || "",
      },
    ]);
    setItems(nextItems);
    setFuture([]);
  };

  // --- Keyboard Shortcuts Handlers ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingText) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          commitState(items.filter((i) => i.id !== selectedId));
          setSelectedId(undefined);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [past, future, items, selectedId, editingText]);

  // --- Drawing Core Engine ---
  const draw = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const isRotated90 = rotation === 90 || rotation === 270;
    canvas.width = isRotated90 ? image.naturalHeight : image.naturalWidth;
    canvas.height = isRotated90 ? image.naturalWidth : image.naturalHeight;

    const ctx = canvas.getContext("2d")!;

    // Background Canvas Set to White
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
      image.naturalWidth,
      image.naturalHeight
    );
    ctx.restore();

    // Render Items
    items.forEach((item) => {
      if (editingText && editingText.id === item.id) return;
      ctx.save();
      renderItem(ctx, item);

      if (item.id === selectedId && tool === "select") {
        ctx.strokeStyle = "#0857C3";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        if (item.kind === "draw") {
          const box = getStrokeBoundingBox(item.points);
          ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
        } else {
          ctx.strokeRect(item.box.x - 2, item.box.y - 2, item.box.w + 4, item.box.h + 4);
        }
      }
      ctx.restore();
    });

    // Render Crop Bounding Box & Handles
    if (cropMode && cropBox) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);

      ctx.strokeStyle = "#0857C3";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(cropBox.x - 1, cropBox.y - 1, cropBox.w + 2, cropBox.h + 2);

      const handles = getCropHandlePositions(cropBox);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0857C3";
      ctx.lineWidth = 2;

      Object.values(handles).forEach((h) => {
        ctx.beginPath();
        ctx.rect(h.x - 5, h.y - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    }
  };

  const getCropHandlePositions = (box: Box): Record<Exclude<CropHandle, "move">, Point> => {
    const { x, y, w, h } = box;
    return {
      nw: { x, y },
      n:  { x: x + w / 2, y },
      ne: { x: x + w, y },
      e:  { x: x + w, y: y + h / 2 },
      se: { x: x + w, y: y + h },
      s:  { x: x + w / 2, y: y + h },
      sw: { x, y: y + h },
      w:  { x, y: y + h / 2 },
    };
  };

  const getCropHandleAtPoint = (p: Point, box: Box): CropHandle | null => {
    const threshold = 12;
    const handles = getCropHandlePositions(box);

    for (const [key, pos] of Object.entries(handles)) {
      if (Math.abs(p.x - pos.x) <= threshold && Math.abs(p.y - pos.y) <= threshold) {
        return key as CropHandle;
      }
    }
    if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) {
      return "move";
    }
    return null;
  };

  const renderItem = (ctx: CanvasRenderingContext2D, item: Item) => {
    if (item.kind === "draw") {
      if (item.points.length < 2) return;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y);
      }
      ctx.stroke();
    } else if (item.kind === "text") {
      ctx.fillStyle = item.color;
      ctx.font = `${item.size}px ${item.font}`;
      ctx.fillText(item.text, item.box.x, item.box.y + item.size);
    } else if (item.kind === "blur") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(item.box.x, item.box.y, item.box.w, item.box.h);
      ctx.clip();

      if (item.blurType === "gaussian" || item.blurType === "box") {
        ctx.filter = `blur(${item.intensity}px)`;
        ctx.drawImage(canvasRef.current!, 0, 0);
      } else if (item.blurType === "median") {
        const pixelSize = Math.max(2, Math.floor(item.intensity));
        const offCanvas = document.createElement("canvas");
        const offCtx = offCanvas.getContext("2d")!;
        const sw = Math.max(1, Math.floor(item.box.w / pixelSize));
        const sh = Math.max(1, Math.floor(item.box.h / pixelSize));

        offCanvas.width = sw;
        offCanvas.height = sh;
        offCtx.drawImage(canvasRef.current!, item.box.x, item.box.y, item.box.w, item.box.h, 0, 0, sw, sh);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offCanvas, 0, 0, sw, sh, item.box.x, item.box.y, item.box.w, item.box.h);
      }
      ctx.restore();
    } else if (item.kind === "shape") {
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.lineWidth = item.strokeWidth;

      const { x, y, w, h } = item.box;

      if (item.shapeType === "rect") {
        if (item.isFilled) {
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.strokeRect(x, y, w, h);
        }
      } else if (item.shapeType === "circle") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
        if (item.isFilled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      } else if (item.shapeType === "line") {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
      } else if (item.shapeType === "arrow") {
        const headLength = Math.min(20, Math.max(10, item.strokeWidth * 3));
        const angle = Math.atan2(h, w);
        const toX = x + w;
        const toY = y + h;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headLength * Math.cos(angle - Math.PI / 6),
          toY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          toX - headLength * Math.cos(angle + Math.PI / 6),
          toY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.lineTo(toX, toY);
        ctx.fill();
      }
    }
  };

  const getStrokeBoundingBox = (points: Point[]): Box => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  useEffect(() => {
    draw();
  }, [items, rotation, flipH, flipV, selectedId, cropMode, cropBox, editingText]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data?.type !== "qpilot-image-edit-source") return;
      const url = event.data.dataUrl;
      const mimeType = url.substring(url.indexOf(":") + 1, url.indexOf(";")) || "image/png";

      setSource({ id: event.data.sessionId, url, mimeType });
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        draw();
      };
      img.src = url;
    };
    window.addEventListener("message", receive);
    if (window.opener) window.opener.postMessage({ type: "qpilot-image-editor-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  };

  // --- Event Handlers ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) finalizeText();
    const p = getCanvasPoint(e);

    if (cropMode && cropBox) {
      const handle = getCropHandleAtPoint(p, cropBox);
      if (handle) {
        dragRef.current = { start: p, mode: "crop", cropHandle: handle };
        return;
      }
    }

    if (tool === "draw") {
      const newStroke: FreehandStroke = {
        id: uid(),
        kind: "draw",
        points: [p],
        color,
        width: brushWidth,
      };
      dragRef.current = { start: p, mode: "draw", activeId: newStroke.id };
      setItems((prev) => [...prev, newStroke]);
      return;
    }

    if (tool === "text") {
      setEditingText({ x: p.x, y: p.y, text: "" });
      return;
    }

    if (tool === "shape") {
      const newShape: ShapeItem = {
        id: uid(),
        kind: "shape",
        shapeType: activeShape,
        box: { x: p.x, y: p.y, w: 0, h: 0 },
        color,
        strokeWidth: brushWidth,
        isFilled: isShapeFilled,
      };
      dragRef.current = { start: p, mode: "resize", activeId: newShape.id };
      setItems((prev) => [...prev, newShape]);
      return;
    }

    if (tool === "blur") {
      const newBlur: BlurItem = {
        id: uid(),
        kind: "blur",
        box: { x: p.x, y: p.y, w: 0, h: 0 },
        blurType,
        intensity: blurRadius,
      };
      dragRef.current = { start: p, mode: "resize", activeId: newBlur.id };
      setItems((prev) => [...prev, newBlur]);
      return;
    }

    if (tool === "select") {
      const clickedItem = [...items].reverse().find((item) => {
        if (item.kind === "draw") {
          const b = getStrokeBoundingBox(item.points);
          return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
        }
        return (
          p.x >= item.box.x &&
          p.x <= item.box.x + item.box.w &&
          p.y >= item.box.y &&
          p.y <= item.box.y + item.box.h
        );
      });

      if (clickedItem) {
        setSelectedId(clickedItem.id);
        dragRef.current = { start: p, mode: "move", activeId: clickedItem.id };
      } else {
        setSelectedId(undefined);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = getCanvasPoint(e);

    if (drag.mode === "crop" && cropBox && drag.cropHandle) {
      const handle = drag.cropHandle;
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      drag.start = p;

      setCropBox((prev) => {
        if (!prev) return null;
        let { x, y, w, h } = prev;

        if (handle === "move") {
          return { ...prev, x: x + dx, y: y + dy };
        }
        if (handle.includes("e")) w += dx;
        if (handle.includes("s")) h += dy;
        if (handle.includes("w")) {
          x += dx;
          w -= dx;
        }
        if (handle.includes("n")) {
          y += dy;
          h -= dy;
        }

        return { x, y, w: Math.max(30, w), h: Math.max(30, h) };
      });
      return;
    }

    if (drag.mode === "draw" && drag.activeId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === drag.activeId && item.kind === "draw"
            ? { ...item, points: [...item.points, p] }
            : item
        )
      );
      return;
    }

    if (drag.mode === "resize" && drag.activeId) {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== drag.activeId || item.kind === "draw") return item;

          let box: Box;
          if (item.kind === "shape" && (item.shapeType === "line" || item.shapeType === "arrow")) {
            box = {
              x: drag.start.x,
              y: drag.start.y,
              w: p.x - drag.start.x,
              h: p.y - drag.start.y,
            };
          } else {
            box = {
              x: Math.min(drag.start.x, p.x),
              y: Math.min(drag.start.y, p.y),
              w: Math.abs(p.x - drag.start.x),
              h: Math.abs(p.y - drag.start.y),
            };
          }

          return { ...item, box };
        })
      );
      return;
    }

    if (drag.mode === "move" && drag.activeId) {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      drag.start = p;

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== drag.activeId) return item;
          if (item.kind === "draw") {
            return {
              ...item,
              points: item.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            };
          }
          return {
            ...item,
            box: { ...item.box, x: item.box.x + dx, y: item.box.y + dy },
          };
        })
      );
    }
  };

  const handlePointerUp = () => {
    if (dragRef.current) {
      if (dragRef.current.mode !== "crop") {
        commitState(items);
      }
      dragRef.current = null;
    }
  };

  const finalizeText = () => {
    if (!editingText || !editingText.text.trim()) {
      setEditingText(null);
      return;
    }
    const newText: TextItem = {
      id: editingText.id || uid(),
      kind: "text",
      box: {
        x: editingText.x,
        y: editingText.y,
        w: editingText.text.length * (fontSize * 0.6),
        h: fontSize,
      },
      text: editingText.text,
      color,
      font,
      size: fontSize,
    };
    commitState([...items.filter((i) => i.id !== editingText.id), newText]);
    setEditingText(null);
    setTool("select");
  };

  // --- Action Transformers ---
  const handleRotate = (deg: number) => {
    commitState(items);
    setRotation((prev) => (prev + deg + 360) % 360);
    setFuture([]);
  };

  const handleFlip = (axis: "h" | "v") => {
    commitState(items);
    if (axis === "h") setFlipH(!flipH);
    if (axis === "v") setFlipV(!flipV);
    setFuture([]);
  };

  const startCropMode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCropMode(true);
    setTool("crop");
    setCropBox({
      x: canvas.width * 0.1,
      y: canvas.height * 0.1,
      w: canvas.width * 0.8,
      h: canvas.height * 0.8,
    });
  };

  const applyCrop = () => {
    if (!cropBox || !canvasRef.current) return;

    commitState(items);

    const canvas = canvasRef.current;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropBox.w;
    tempCanvas.height = cropBox.h;

    const ctx = tempCanvas.getContext("2d")!;
    // Set background canvas hasil crop ke putih
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    ctx.drawImage(
      canvas,
      cropBox.x,
      cropBox.y,
      cropBox.w,
      cropBox.h,
      0,
      0,
      cropBox.w,
      cropBox.h
    );

    const croppedUrl = tempCanvas.toDataURL("image/png");

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setItems([]);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCropMode(false);
      setCropBox(null);
      setTool("select");
      draw();
    };
    img.src = croppedUrl;
  };

  const handleUndo = () => {
    if (!past.length) return;
    const previousFrame = past.at(-1)!;

    setFuture([
      {
        items: clone(items),
        rotation,
        flipH,
        flipV,
        imageSrc: imageRef.current?.src || "",
      },
      ...future,
    ]);

    setPast(past.slice(0, -1));
    setItems(previousFrame.items);
    setRotation(previousFrame.rotation);
    setFlipH(previousFrame.flipH);
    setFlipV(previousFrame.flipV);

    if (previousFrame.imageSrc && previousFrame.imageSrc !== imageRef.current?.src) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        draw();
      };
      img.src = previousFrame.imageSrc;
    }
  };

  const handleRedo = () => {
    if (!future.length) return;
    const nextFrame = future[0];

    setFuture(future.slice(1));
    setPast([
      ...past,
      {
        items: clone(items),
        rotation,
        flipH,
        flipV,
        imageSrc: imageRef.current?.src || "",
      },
    ]);

    setItems(nextFrame.items);
    setRotation(nextFrame.rotation);
    setFlipH(nextFrame.flipH);
    setFlipV(nextFrame.flipV);

    if (nextFrame.imageSrc && nextFrame.imageSrc !== imageRef.current?.src) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        draw();
      };
      img.src = nextFrame.imageSrc;
    }
  };

  // 1. Save Image (Function bawaan eksisting)
  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png", exportQuality);

    if (window.opener && !window.opener.closed && source?.id) {
      window.opener.postMessage(
        { type: "qpilot-image-edit-result", sessionId: source.id, dataUrl },
        window.location.origin
      );
      window.close();
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `edited-image.png`;
      a.click();
    }
  };

  // 2. Save to Local (Export khusus PNG, JPEG, WEBP)
  const saveToLocal = (format: "png" | "jpeg" | "webp") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mimeType = `image/${format}`;
    const dataUrl = canvas.toDataURL(mimeType, exportQuality);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `canvas-export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowLocalDropdown(false);
  };

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden font-sans"
      style={{
        backgroundColor: "var(--bg-canvas, #F4F7FB)",
        color: "var(--text-body, #334155)",
      }}
    >
      {/* --- Sidebar Toolbar --- */}
      <aside 
        className="flex w-16 flex-col items-center justify-between border-r p-3"
        style={{
          backgroundColor: "var(--bg-surface, #FFFFFF)",
          borderColor: "var(--border-subtle, #E2E8F0)",
        }}
      >
        <div className="flex flex-col gap-3">
          <button
            title="Select & Move (V)"
            className="rounded-xl p-2.5 transition"
            style={{
              backgroundColor: tool === "select" ? "var(--brand-primary, #0857C3)" : "transparent",
              color: tool === "select" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
            }}
            onClick={() => {
              setCropMode(false);
              setTool("select");
            }}
          >
            <MousePointer size={20} />
          </button>
          <button
            title="Draw Freehand"
            className="rounded-xl p-2.5 transition"
            style={{
              backgroundColor: tool === "draw" ? "var(--brand-primary, #0857C3)" : "transparent",
              color: tool === "draw" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
            }}
            onClick={() => {
              setCropMode(false);
              setTool("draw");
            }}
          >
            <Pencil size={20} />
          </button>
          <button
            title="Shapes & Annotations"
            className="rounded-xl p-2.5 transition"
            style={{
              backgroundColor: tool === "shape" ? "var(--brand-primary, #0857C3)" : "transparent",
              color: tool === "shape" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
            }}
            onClick={() => {
              setCropMode(false);
              setTool("shape");
            }}
          >
            <Square size={20} />
          </button>
          <button
            title="Add Text"
            className="rounded-xl p-2.5 transition"
            style={{
              backgroundColor: tool === "text" ? "var(--brand-primary, #0857C3)" : "transparent",
              color: tool === "text" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
            }}
            onClick={() => {
              setCropMode(false);
              setTool("text");
            }}
          >
            <Type size={20} />
          </button>
          <button
            title="Blur / Smoothening"
            className="rounded-xl p-2.5 transition"
            style={{
              backgroundColor: tool === "blur" ? "var(--brand-primary, #0857C3)" : "transparent",
              color: tool === "blur" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
            }}
            onClick={() => {
              setCropMode(false);
              setTool("blur");
            }}
          >
            <EyeOff size={20} />
          </button>
          <button
            title="Crop Image"
            className="rounded-xl p-2.5 transition"
            style={{
              backgroundColor: cropMode ? "var(--brand-primary, #0857C3)" : "transparent",
              color: cropMode ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
            }}
            onClick={startCropMode}
          >
            <Crop size={20} />
          </button>
        </div>

        {selectedId && (
          <button
            title="Delete Selected (Delete/Backspace)"
            className="rounded-xl bg-red-500/10 p-2.5 text-red-600 hover:bg-red-500/20 transition"
            onClick={() => {
              commitState(items.filter((i) => i.id !== selectedId));
              setSelectedId(undefined);
            }}
          >
            <Trash2 size={20} />
          </button>
        )}
      </aside>

      {/* --- Main Workspace --- */}
      <div className="flex flex-1 flex-col">
        {/* --- Top Floating Action Header --- */}
        <header 
          className="flex h-16 items-center justify-between border-b px-6 shadow-sm"
          style={{
            backgroundColor: "var(--bg-surface, #FFFFFF)",
            borderColor: "var(--border-subtle, #E2E8F0)",
          }}
        >
          {/* Tool Options Controls */}
          <div className="flex items-center gap-4 text-sm">
            {(tool === "draw" || tool === "shape") && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted, #64748B)" }}>
                  THICKNESS:
                </span>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={brushWidth}
                  onChange={(e) => setBrushWidth(Number(e.target.value))}
                  className="h-1.5 w-24 cursor-pointer"
                  style={{ accentColor: "var(--brand-primary, #0857C3)" }}
                />
              </div>
            )}

            {tool === "shape" && (
              <div className="flex items-center gap-2 border-l pl-4" style={{ borderColor: "var(--border-subtle, #E2E8F0)" }}>
                <div className="flex rounded-lg p-1" style={{ backgroundColor: "var(--bg-canvas, #F4F7FB)" }}>
                  <button
                    className="rounded-md p-1.5 transition"
                    style={{
                      backgroundColor: activeShape === "rect" ? "var(--brand-primary, #0857C3)" : "transparent",
                      color: activeShape === "rect" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
                    }}
                    onClick={() => setActiveShape("rect")}
                    title="Rectangle"
                  >
                    <Square size={16} />
                  </button>
                  <button
                    className="rounded-md p-1.5 transition"
                    style={{
                      backgroundColor: activeShape === "circle" ? "var(--brand-primary, #0857C3)" : "transparent",
                      color: activeShape === "circle" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
                    }}
                    onClick={() => setActiveShape("circle")}
                    title="Circle"
                  >
                    <CircleIcon size={16} />
                  </button>
                  <button
                    className="rounded-md p-1.5 transition"
                    style={{
                      backgroundColor: activeShape === "line" ? "var(--brand-primary, #0857C3)" : "transparent",
                      color: activeShape === "line" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
                    }}
                    onClick={() => setActiveShape("line")}
                    title="Straight Line"
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    className="rounded-md p-1.5 transition"
                    style={{
                      backgroundColor: activeShape === "arrow" ? "var(--brand-primary, #0857C3)" : "transparent",
                      color: activeShape === "arrow" ? "var(--text-on-primary, #FFFFFF)" : "var(--text-muted, #64748B)",
                    }}
                    onClick={() => setActiveShape("arrow")}
                    title="Arrow"
                  >
                    <MoveRight size={16} />
                  </button>
                </div>

                {(activeShape === "rect" || activeShape === "circle") && (
                  <button
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold border transition"
                    style={{
                      borderColor: "var(--brand-primary, #0857C3)",
                      backgroundColor: isShapeFilled ? "var(--brand-primary, #0857C3)" : "transparent",
                      color: isShapeFilled ? "var(--text-on-primary, #FFFFFF)" : "var(--brand-primary, #0857C3)",
                    }}
                    onClick={() => setIsShapeFilled(!isShapeFilled)}
                  >
                    {isShapeFilled ? "Filled" : "Outline"}
                  </button>
                )}
              </div>
            )}

            {tool === "text" && (
              <div className="flex items-center gap-3">
                <select
                  className="rounded-lg border px-2.5 py-1"
                  style={{
                    borderColor: "var(--border-subtle, #E2E8F0)",
                    backgroundColor: "var(--bg-surface, #FFFFFF)",
                    color: "var(--text-body, #334155)",
                  }}
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                >
                  {fonts.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="w-16 rounded-lg border px-2 py-1 text-center"
                  style={{
                    borderColor: "var(--border-subtle, #E2E8F0)",
                    backgroundColor: "var(--bg-surface, #FFFFFF)",
                    color: "var(--text-body, #334155)",
                  }}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>
            )}

            {tool === "blur" && (
              <div className="flex items-center gap-3">
                <select
                  className="rounded-lg border px-2 py-1 text-xs"
                  style={{
                    borderColor: "var(--border-subtle, #E2E8F0)",
                    backgroundColor: "var(--bg-surface, #FFFFFF)",
                    color: "var(--text-body, #334155)",
                  }}
                  value={blurType}
                  onChange={(e) => setBlurType(e.target.value as BlurType)}
                >
                  <option value="gaussian">Gaussian Blur</option>
                  <option value="box">Averaging (Box Blur)</option>
                  <option value="median">Median / Pixelate</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <Sliders size={14} style={{ color: "var(--text-muted, #64748B)" }} />
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(Number(e.target.value))}
                    className="h-1.5 w-20 cursor-pointer"
                    style={{ accentColor: "var(--brand-primary, #0857C3)" }}
                  />
                </div>
              </div>
            )}

            {(tool === "draw" || tool === "text" || tool === "shape") && (
              <div className="flex items-center gap-1.5 border-l pl-4" style={{ borderColor: "var(--border-subtle, #E2E8F0)" }}>
                {colors.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded-full transition border ${
                      color === c ? "ring-2 ring-offset-2" : ""
                    }`}
                    style={{
                      backgroundColor: c,
                      borderColor: "var(--border-subtle, #E2E8F0)",
                      outlineColor: "var(--brand-primary, #0857C3)",
                    }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Transformation Tools */}
          <div className="flex items-center gap-1">
            <button
              title="Rotate Counter-Clockwise"
              className="rounded-lg p-2 transition hover:bg-slate-100"
              style={{ color: "var(--text-muted, #64748B)" }}
              onClick={() => handleRotate(-90)}
            >
              <RotateCcw size={18} />
            </button>
            <button
              title="Rotate Clockwise"
              className="rounded-lg p-2 transition hover:bg-slate-100"
              style={{ color: "var(--text-muted, #64748B)" }}
              onClick={() => handleRotate(90)}
            >
              <RotateCw size={18} />
            </button>
            <button
              title="Flip Horizontally"
              className="rounded-lg p-2 transition hover:bg-slate-100"
              style={{ color: "var(--text-muted, #64748B)" }}
              onClick={() => handleFlip("h")}
            >
              <FlipHorizontal size={18} />
            </button>
            <button
              title="Flip Vertically"
              className="rounded-lg p-2 transition hover:bg-slate-100"
              style={{ color: "var(--text-muted, #64748B)" }}
              onClick={() => handleFlip("v")}
            >
              <FlipVertical size={18} />
            </button>
          </div>

          {/* Save & History Header Controls */}
          <div className="flex items-center gap-2">
            <button
              disabled={!past.length}
              title="Undo (Ctrl+Z)"
              className="rounded-lg p-2 transition hover:bg-slate-100 disabled:opacity-30"
              style={{ color: "var(--text-muted, #64748B)" }}
              onClick={handleUndo}
            >
              <Undo size={18} />
            </button>
            <button
              disabled={!future.length}
              title="Redo (Ctrl+Y)"
              className="rounded-lg p-2 transition hover:bg-slate-100 disabled:opacity-30"
              style={{ color: "var(--text-muted, #64748B)" }}
              onClick={handleRedo}
            >
              <Redo size={18} />
            </button>

            {cropMode ? (
              <div className="ml-2 flex gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition"
                  style={{ backgroundColor: "var(--brand-primary, #0857C3)" }}
                  onClick={applyCrop}
                >
                  <Check size={14} /> Apply Crop
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    borderColor: "var(--border-subtle, #E2E8F0)",
                    backgroundColor: "var(--bg-surface, #FFFFFF)",
                    color: "var(--text-body, #334155)",
                  }}
                  onClick={() => {
                    setCropMode(false);
                    setCropBox(null);
                    setTool("select");
                  }}
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            ) : (
              <div className="ml-2 flex items-center gap-2 border-l pl-3" style={{ borderColor: "var(--border-subtle, #E2E8F0)" }}>
                
                {/* 1. Save Image (Function Bawaan) */}
                <button
                  className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition shadow-sm"
                  style={{
                    backgroundColor: "var(--brand-primary, #0857C3)",
                    color: "var(--text-on-primary, #FFFFFF)",
                  }}
                  onClick={saveImage}
                >
                  <Save size={16} /> Save Image
                </button>

                {/* 2. Save to Local (Dropdown Export Format) */}
                <div className="relative">
                  <button
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition shadow-sm"
                    style={{
                      backgroundColor: "var(--brand-accent, #71C5E8)",
                      color: "var(--text-on-accent, #0B0F19)",
                    }}
                    onClick={() => setShowLocalDropdown(!showLocalDropdown)}
                  >
                    <Download size={16} />
                    Save to Local
                    <ChevronDown size={14} />
                  </button>

                  {showLocalDropdown && (
                    <div
                      className="absolute right-0 mt-2 w-36 rounded-lg border p-1 shadow-lg z-50"
                      style={{
                        backgroundColor: "var(--bg-surface, #FFFFFF)",
                        borderColor: "var(--border-subtle, #E2E8F0)",
                      }}
                    >
                      <button
                        className="w-full text-left rounded-md px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
                        style={{ color: "var(--text-heading, #0F172A)" }}
                        onClick={() => saveToLocal("png")}
                      >
                        PNG Image
                      </button>
                      <button
                        className="w-full text-left rounded-md px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
                        style={{ color: "var(--text-heading, #0F172A)" }}
                        onClick={() => saveToLocal("jpeg")}
                      >
                        JPEG Image
                      </button>
                      <button
                        className="w-full text-left rounded-md px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
                        style={{ color: "var(--text-heading, #0F172A)" }}
                        onClick={() => saveToLocal("webp")}
                      >
                        WEBP Image
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </header>

        {/* Viewport Canvas Render Container */}
        <main 
          className="relative flex flex-1 items-center justify-center overflow-auto p-6"
          style={{ backgroundColor: "var(--bg-canvas, #F4F7FB)" }}
        >
          {/* Canvas Berwarna Putih Murni */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-h-[82vh] max-w-full rounded-lg shadow-xl touch-none border"
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: "var(--border-subtle, #E2E8F0)",
            }}
          />

          {/* Floating Text Field Layer */}
          {editingText && (
            <input
              autoFocus
              type="text"
              value={editingText.text}
              onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
              onBlur={finalizeText}
              onKeyDown={(e) => e.key === "Enter" && finalizeText()}
              style={{
                position: "absolute",
                left: `${editingText.x}px`,
                top: `${editingText.y}px`,
                fontSize: `${fontSize}px`,
                fontFamily: font,
                color: color,
                borderColor: "var(--brand-primary, #0857C3)",
              }}
              className="border-b-2 bg-transparent outline-none"
            />
          )}
        </main>
      </div>
    </div>
  );
}