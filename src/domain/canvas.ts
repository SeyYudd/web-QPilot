export function naturalPoint(event: PointerEvent, canvas: HTMLCanvasElement, width: number, height: number) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)),
    y: Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height)),
  }
}

export function drawAnnotation(context: CanvasRenderingContext2D, annotation: { type: string; x?: number; y?: number; width?: number; height?: number; points?: Array<{ x: number; y: number }>; color?: string; strokeWidth?: number; text?: string; fontSize?: number }) {
  context.save()
  context.strokeStyle = annotation.color ?? "#ef4444"
  context.fillStyle = annotation.color ?? "#ef4444"
  context.lineWidth = annotation.strokeWidth ?? 4
  context.lineCap = "round"
  if (annotation.type === "rectangle") context.strokeRect(annotation.x ?? 0, annotation.y ?? 0, annotation.width ?? 0, annotation.height ?? 0)
  if (annotation.type === "ellipse") {
    context.beginPath()
    context.ellipse((annotation.x ?? 0) + (annotation.width ?? 0) / 2, (annotation.y ?? 0) + (annotation.height ?? 0) / 2, Math.abs(annotation.width ?? 0) / 2, Math.abs(annotation.height ?? 0) / 2, 0, 0, Math.PI * 2)
    context.stroke()
  }
  if (annotation.type === "line" || annotation.type === "arrow" || annotation.type === "freehand") {
    const points = annotation.points ?? []
    if (points.length > 1) {
      context.beginPath()
      context.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
      context.stroke()
      if (annotation.type === "arrow") {
        const end = points[points.length - 1]
        context.beginPath()
        context.moveTo(end.x - 12, end.y - 5)
        context.lineTo(end.x, end.y)
        context.lineTo(end.x - 5, end.y + 12)
        context.stroke()
      }
    }
  }
  if (annotation.type === "text") {
    context.font = `${annotation.fontSize ?? 28}px sans-serif`
    context.fillText(annotation.text ?? "", annotation.x ?? 0, annotation.y ?? 0)
  }
  context.restore()
}
