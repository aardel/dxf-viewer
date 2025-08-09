// Shared utils extracted from unified-viewer.html

function computeDDSFit() {
  if (!window.ddsData || !window.ddsData.length) return { fitScale: 1, fitOffsetX: 0, fitOffsetY: 0 };
  const bounds = getBounds(window.ddsData);
  const pad = 40;
  const fitScaleX = (canvas.width - 2 * pad) / (bounds.maxX - bounds.minX);
  const fitScaleY = (canvas.height - 2 * pad) / (bounds.maxY - bounds.minY);
  const fitScale = Math.min(fitScaleX, fitScaleY) * 0.95;
  const fitOffsetX = (canvas.width - (bounds.maxX - bounds.minX) * fitScale) / 2 - bounds.minX * fitScale;
  const fitOffsetY = (canvas.height + (bounds.maxY - bounds.minY) * fitScale) / 2 + bounds.minY * fitScale;
  return { fitScale, fitOffsetX, fitOffsetY };
}

function canvasToModelDDS(canvasX, canvasY) {
  const { fitScale, fitOffsetX, fitOffsetY } = computeDDSFit();
  return {
    x: (canvasX - ddsView.offsetX - fitOffsetX) / (ddsView.scale * fitScale),
    y: -(canvasY - ddsView.offsetY - fitOffsetY) / (ddsView.scale * fitScale)
  };
}

function modelToCanvasDDS(modelX, modelY) {
  const { fitScale, fitOffsetX, fitOffsetY } = computeDDSFit();
  return {
    x: ddsView.offsetX + fitOffsetX + modelX * (ddsView.scale * fitScale),
    y: ddsView.offsetY + fitOffsetY - modelY * (ddsView.scale * fitScale)
  };
}

function computeCFF2Fit() {
  if (!window.cff2Data || !window.cff2Data.boundingBox) return { fitScale: 1, fitOffsetX: 0, fitOffsetY: 0 };
  const bb = window.cff2Data.boundingBox;
  const geoWidth = bb.upperRight.x - bb.lowerLeft.x;
  const geoHeight = bb.upperRight.y - bb.lowerLeft.y;
  const fitScaleX = canvas.width / geoWidth;
  const fitScaleY = canvas.height / geoHeight;
  const fitScale = Math.min(fitScaleX, fitScaleY) * 0.95;
  const fitOffsetX = (canvas.width - geoWidth * fitScale) / 2 - bb.lowerLeft.x * fitScale;
  const fitOffsetY = (canvas.height + geoHeight * fitScale) / 2 + bb.lowerLeft.y * fitScale;
  return { fitScale, fitOffsetX, fitOffsetY };
}

function canvasToModelCFF2(canvasX, canvasY) {
  const { fitScale, fitOffsetX, fitOffsetY } = computeCFF2Fit();
  return {
    x: (canvasX - view.offsetX - fitOffsetX) / (view.scale * fitScale),
    y: -(canvasY - view.offsetY - fitOffsetY) / (view.scale * fitScale)
  };
}

function modelToCanvasCFF2(modelX, modelY) {
  const { fitScale, fitOffsetX, fitOffsetY } = computeCFF2Fit();
  return {
    x: view.offsetX + fitOffsetX + modelX * (view.scale * fitScale),
    y: view.offsetY + fitOffsetY - modelY * (view.scale * fitScale)
  };
}

function snapCanvasPointToNearestEndpoint(canvasX, canvasY) {
  const thresholdPx = 12;
  let best = { x: canvasX, y: canvasY };
  let bestDist = Infinity;

  if (window.currentFormat === 'dds' && Array.isArray(window.ddsData) && window.ddsData.length) {
    for (let i = 0; i < window.ddsData.length; i++) {
      const e = window.ddsData[i];
      const key = getDDSGroupKey(e);
      if (!window.ddsLineTypes[key]?.visible) continue;
      const endpoints = [];
      if (e.type === 'LINE') {
        endpoints.push({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
      } else if (e.type === 'ARC') {
        endpoints.push({ x: e.sx, y: e.sy }, { x: e.ex, y: e.ey });
      }
      for (const p of endpoints) {
        const pc = modelToCanvasDDS(p.x, p.y);
        const d = Math.hypot(pc.x - canvasX, pc.y - canvasY);
        if (d < bestDist) { bestDist = d; best = pc; }
      }
    }
  } else if (window.currentFormat === 'cff2' && Array.isArray(window.cff2Data) && window.cff2Data.length) {
    for (let i = 0; i < window.cff2Data.length; i++) {
      const e = window.cff2Data[i];
      const key = `${e.pen}-${e.layer}`;
      if (!window.lineTypes[key]?.visible) continue;
      const endpoints = [];
      if (e.type === 'L') {
        endpoints.push({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
      } else if (e.type === 'A') {
        endpoints.push({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
      }
      for (const p of endpoints) {
        const pc = modelToCanvasCFF2(p.x, p.y);
        const d = Math.hypot(pc.x - canvasX, pc.y - canvasY);
        if (d < bestDist) { bestDist = d; best = pc; }
      }
    }
  }

  if (bestDist <= thresholdPx) return best;
  return { x: canvasX, y: canvasY };
}

// ----- Shared geometry/helpers -----
function getBounds(entities) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    if (e.type === 'LINE') {
      minX = Math.min(minX, e.x1, e.x2);
      minY = Math.min(minY, e.y1, e.y2);
      maxX = Math.max(maxX, e.x1, e.x2);
      maxY = Math.max(maxY, e.y1, e.y2);
    } else if (e.type === 'ARC') {
      const r = Math.abs(e.radius);
      minX = Math.min(minX, e.cx - r);
      minY = Math.min(minY, e.cy - r);
      maxX = Math.max(maxX, e.cx + r);
      maxY = Math.max(maxY, e.cy + r);
    }
  }
  return { minX, minY, maxX, maxY };
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function pointToArcDist(px, py, arc) {
  const r = Math.abs(arc.radius);
  const angle = Math.atan2(py - arc.cy, px - arc.cx);
  const start = Math.atan2(arc.sy - arc.cy, arc.sx - arc.cx);
  const end = Math.atan2(arc.ey - arc.cy, arc.ex - arc.cx);
  let inArc = false;
  if (arc.radius < 0) {
    inArc = (start > end) ? (angle <= start && angle >= end) : (angle <= start || angle >= end);
  } else {
    inArc = (end > start) ? (angle >= start && angle <= end) : (angle >= start || angle <= end);
  }
  const distToCirc = Math.abs(Math.hypot(px - arc.cx, py - arc.cy) - r);
  if (!inArc) return Infinity;
  return distToCirc;
}

function overlayBridgeGaps(entity, ctx, baseLineWidth) {
  const bridgeCount = entity.bridgeCount || 0;
  const bridgeWidth = entity.bridgeWidth || 0;
  if (bridgeCount === 0 || bridgeWidth === 0) return;

  const realLineLength = Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
  if (realLineLength === 0) return;

  const totalBridgeLength = bridgeCount * bridgeWidth;
  const totalDrawingLength = realLineLength - totalBridgeLength;
  const segmentLength = totalDrawingLength / (bridgeCount + 1);
  if (!isFinite(segmentLength) || segmentLength <= 0) return;

  const dirX = (entity.x2 - entity.x1) / realLineLength;
  const dirY = (entity.y2 - entity.y1) / realLineLength;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = baseLineWidth * 1.5;
  ctx.lineCap = 'butt';
  ctx.beginPath();

  for (let i = 0; i < bridgeCount; i++) {
    const gapStartPos = (i + 1) * segmentLength + i * bridgeWidth;
    const gapEndPos = gapStartPos + bridgeWidth;
    const sx = entity.x1 + dirX * gapStartPos;
    const sy = entity.y1 + dirY * gapStartPos;
    const ex = entity.x1 + dirX * gapEndPos;
    const ey = entity.y1 + dirY * gapEndPos;
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
  }

  ctx.stroke();
  ctx.restore();
}

function overlayBridgeGapsOnArc(entity, ctx, baseLineWidth) {
  const bridgeCount = entity.bridgeCount || 0;
  const bridgeWidth = entity.bridgeWidth || 0;
  if (bridgeCount === 0 || bridgeWidth === 0) return;

  let r = Math.abs(entity.radius);
  if (!isFinite(r) || r === 0) return;

  const startAngle = Math.atan2(entity.sy - entity.cy, entity.sx - entity.cx);
  const endAngle = Math.atan2(entity.ey - entity.cy, entity.ex - entity.cx);
  const ccw = entity.radius < 0;

  let sweep = endAngle - startAngle;
  if (ccw && sweep > 0) sweep -= 2 * Math.PI;
  if (!ccw && sweep < 0) sweep += 2 * Math.PI;
  const startAtCenter = Math.abs(entity.sx - entity.cx) < 1e-6 && Math.abs(entity.sy - entity.cy) < 1e-6;
  const endAtCenter = Math.abs(entity.ex - entity.cx) < 1e-6 && Math.abs(entity.ey - entity.cy) < 1e-6;
  const isFullCircle = Math.abs(entity.sx - entity.ex) < 1e-6 && Math.abs(entity.sy - entity.ey) < 1e-6 && !(startAtCenter || endAtCenter);
  const arcLen = isFullCircle ? (2 * Math.PI * r) : (r * Math.abs(sweep));
  if (!isFinite(arcLen) || arcLen === 0) return;

  const totalBridgeLength = bridgeCount * bridgeWidth;
  const totalDrawingLength = arcLen - totalBridgeLength;
  const segmentLen = totalDrawingLength / (bridgeCount + 1);
  if (!isFinite(segmentLen) || segmentLen <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = baseLineWidth * 1.5;
  ctx.lineCap = 'butt';
  ctx.beginPath();

  for (let i = 0; i < bridgeCount; i++) {
    const gapStartLen = (i + 1) * segmentLen + i * bridgeWidth;
    const gapEndLen = gapStartLen + bridgeWidth;
    const gapStartAngle = startAngle + (ccw ? -gapStartLen / r : gapStartLen / r);
    const gapEndAngle = startAngle + (ccw ? -gapEndLen / r : gapEndLen / r);
    ctx.arc(entity.cx, entity.cy, r, gapStartAngle, gapEndAngle, ccw);
  }

  ctx.stroke();
  ctx.restore();
}


