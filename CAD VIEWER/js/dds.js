// DDS-specific parsing, rendering, UI wiring

function roundKerf(value) {
  const v = Number(value) || 0;
  return Math.round(v * 10000) / 10000;
}

function getDDSGroupKey(entity) {
  return `${entity.color}|${roundKerf(entity.kerfWidth)}`;
}

function parseDDS(text) {
  const lines = text.split(/\r?\n/);
  const entities = [];
  window.ddsLineTypes = {};
  window.ddsRawCodeLines = lines;

  lines.forEach((line, lineIndex) => {
    if (line.trim() === '' || line.startsWith('\\') || line.startsWith('*') || line.startsWith('SUB')) {
      return;
    }

    const entityData = { lineIndex, originalLine: line };

    if (line.startsWith('LINE')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        entityData.type = 'LINE';
        entityData.x1 = parseFloat(parts[1]);
        entityData.y1 = parseFloat(parts[2]);
        entityData.x2 = parseFloat(parts[3]);
        entityData.y2 = parseFloat(parts[4]);
        entityData.color = parts[5] || '0';
        entityData.width = parseFloat(parts[6] || '0.0280');
        entityData.lineType = parseInt(parts[7] || '0', 10);
        entityData.weight = parseFloat(parts[8] || '0.0000');
        entityData.kerfWidth = parseFloat(parts[6] || '0.0280');
        entityData.bridgeCount = parseInt(parts[7] || '0', 10);
        entityData.bridgeWidth = parseFloat(parts[8] || '0.0000');

        const kerfRounded = roundKerf(entityData.kerfWidth);
        const key = `${entityData.color}|${kerfRounded}`;
        if (!window.ddsLineTypes[key]) {
          window.ddsLineTypes[key] = {
            color: entityData.color,
            kerf: kerfRounded,
            displayColor: colorFromCode(entityData.color),
            visible: true,
            count: 0,
            lineCount: 0,
            arcCount: 0,
            totalLength: 0,
            totalBridge: 0,
            entities: []
          };
          const persisted = window.viewerSettings?.dds?.buckets?.[key];
          if (persisted) {
            if (persisted.displayColor) window.ddsLineTypes[key].displayColor = persisted.displayColor;
            if (typeof persisted.visible === 'boolean') window.ddsLineTypes[key].visible = persisted.visible;
          }
        }

        entities.push(entityData);
        const group = window.ddsLineTypes[key];
        group.count++;
        group.lineCount++;
        const len = Math.hypot(entityData.x2 - entityData.x1, entityData.y2 - entityData.y1);
        if (isFinite(len)) group.totalLength += len;
        group.totalBridge += (entityData.bridgeCount || 0) * (entityData.bridgeWidth || 0);
        group.entities.push(entities.length - 1);
      }
    } else if (line.startsWith('ARC')) {
      const parts = line.split(/\s+/);
      // Match the existing parser in unified-viewer.html (sx,sy,ex,ey,cx,cy,radius,...)
      if (parts.length >= 12) {
        entityData.type = 'ARC';
        entityData.sx = parseFloat(parts[1]);
        entityData.sy = parseFloat(parts[2]);
        entityData.ex = parseFloat(parts[3]);
        entityData.ey = parseFloat(parts[4]);
        entityData.cx = parseFloat(parts[5]);
        entityData.cy = parseFloat(parts[6]);
        entityData.radius = parseFloat(parts[7]);
        entityData.color = parts[8] || '0';
        entityData.width = parseFloat(parts[9] || '0.0280');
        entityData.lineType = parseInt(parts[10] || '0', 10);
        entityData.weight = parseFloat(parts[11] || '0.0000');
        entityData.kerfWidth = parseFloat(parts[9] || '0.0280');
        entityData.bridgeCount = parseInt(parts[10] || '0', 10);
        entityData.bridgeWidth = parseFloat(parts[11] || '0.0000');

        const kerfRounded = roundKerf(entityData.kerfWidth);
        const key = `${entityData.color}|${kerfRounded}`;
        if (!window.ddsLineTypes[key]) {
          window.ddsLineTypes[key] = {
            color: entityData.color,
            kerf: kerfRounded,
            displayColor: colorFromCode(entityData.color),
            visible: true,
            count: 0,
            lineCount: 0,
            arcCount: 0,
            totalLength: 0,
            totalBridge: 0,
            entities: []
          };
          const persisted = window.viewerSettings?.dds?.buckets?.[key];
          if (persisted) {
            if (persisted.displayColor) window.ddsLineTypes[key].displayColor = persisted.displayColor;
            if (typeof persisted.visible === 'boolean') window.ddsLineTypes[key].visible = persisted.visible;
          }
        }

        entities.push(entityData);
        const group = window.ddsLineTypes[key];
        group.count++;
        group.arcCount++;
        const r = Math.abs(entityData.radius);
        const startAngle = Math.atan2(entityData.sy - entityData.cy, entityData.sx - entityData.cx);
        const endAngle = Math.atan2(entityData.ey - entityData.cy, entityData.ex - entityData.cx);
        let sweep = endAngle - startAngle;
        if (entityData.radius < 0 && sweep > 0) sweep -= 2 * Math.PI;
        if (entityData.radius >= 0 && sweep < 0) sweep += 2 * Math.PI;
        const arcLen = r * Math.abs(sweep);
        if (isFinite(arcLen)) group.totalLength += arcLen;
        group.totalBridge += (entityData.bridgeCount || 0) * (entityData.bridgeWidth || 0);
        group.entities.push(entities.length - 1);
      }
    }
  });

  window.ddsData = entities;
  setupDDSControls();
  displayDDSCode(text);
  fitDDSView();
}

function drawDDS() {
  if (!window.ddsData || !window.ddsData.length) return;
  const { fitScale, fitOffsetX, fitOffsetY } = computeDDSFit();
  ctx.save();
  ctx.translate(ddsView.offsetX + fitOffsetX, ddsView.offsetY + fitOffsetY);
  ctx.scale(ddsView.scale * fitScale, -ddsView.scale * fitScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  window.ddsData.forEach((entity, idx) => {
    const key = getDDSGroupKey(entity);
    const typeInfo = window.ddsLineTypes[key];
    if (!typeInfo || !typeInfo.visible) return;

    ctx.save();
    let strokeColor = typeInfo.displayColor;
    let lineWidth = 1 / (ddsView.scale * fitScale);
    if (window.ddsSelectedEntity && window.ddsSelectedEntity.idx === idx) {
      strokeColor = '#FF0000';
      lineWidth = 4 / (ddsView.scale * fitScale);
    } else if (window.ddsHoveredEntity && window.ddsHoveredEntity.idx === idx) {
      strokeColor = '#FF0';
      lineWidth = 3 / (ddsView.scale * fitScale);
    } else if (window.ddsHighlightedLineType === key) {
      strokeColor = '#00FF00';
      lineWidth = 2 / (ddsView.scale * fitScale);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    if (entity.type === 'LINE') {
      ctx.moveTo(entity.x1, entity.y1);
      ctx.lineTo(entity.x2, entity.y2);
    } else if (entity.type === 'ARC') {
      const cx = entity.cx, cy = entity.cy;
      const sx = entity.sx, sy = entity.sy;
      const ex = entity.ex, ey = entity.ey;
      let r = entity.radius;
      if (!isFinite(r) || r === 0) { ctx.restore(); return; }
      const startAtCenter = Math.abs(sx - cx) < 1e-6 && Math.abs(sy - cy) < 1e-6;
      const endAtCenter = Math.abs(ex - cx) < 1e-6 && Math.abs(ey - cy) < 1e-6;
      if (startAtCenter || endAtCenter) { ctx.restore(); return; }
      let startAngle = Math.atan2(sy - cy, sx - cx);
      let endAngle = Math.atan2(ey - cy, ex - cx);
      let anticlockwise = false;
      if (r < 0) { anticlockwise = true; r = Math.abs(r); }
      const isFullCircle = Math.abs(sx - ex) < 1e-6 && Math.abs(sy - ey) < 1e-6;
      if (!isFullCircle && !anticlockwise) {
        let sweep = endAngle - startAngle;
        if (sweep < 0) sweep += 2 * Math.PI;
        if (sweep > Math.PI) { anticlockwise = true; }
      }
      if (isFullCircle) {
        ctx.arc(cx, cy, Math.abs(r), 0, 2 * Math.PI, false);
      } else {
        ctx.arc(cx, cy, Math.abs(r), startAngle, endAngle, anticlockwise);
      }
    }

    ctx.stroke();
    if (entity.type === 'LINE') {
      const renderBridges = document.getElementById('dds-render-bridges');
      const shouldOverlay = renderBridges ? renderBridges.checked : true;
      if (shouldOverlay) { overlayBridgeGaps(entity, ctx, lineWidth); }
    } else if (entity.type === 'ARC') {
      const renderBridges = document.getElementById('dds-render-bridges');
      const shouldOverlay = renderBridges ? renderBridges.checked : true;
      if (shouldOverlay) { overlayBridgeGapsOnArc(entity, ctx, lineWidth); }
    }
    ctx.restore();
  });

  ctx.restore();
  drawDDSTooltip();
  drawMeasureOverlay();
}

function findDDSEntityAt(canvasX, canvasY) {
  if (!window.ddsData || !window.ddsData.length) return null;
  const { fitScale, fitOffsetX, fitOffsetY } = computeDDSFit();
  const x = (canvasX - ddsView.offsetX - fitOffsetX) / (ddsView.scale * fitScale);
  const y = -(canvasY - ddsView.offsetY - fitOffsetY) / (ddsView.scale * fitScale);
  let minDist = 0.05 * (1 / ddsView.scale);
  let found = null;
  window.ddsData.forEach((entity, idx) => {
    const key = getDDSGroupKey(entity);
    if (!window.ddsLineTypes[key]?.visible) return;
    let dist = Infinity;
    if (entity.type === 'LINE') {
      dist = pointToSegmentDist(x, y, entity.x1, entity.y1, entity.x2, entity.y2);
    } else if (entity.type === 'ARC') {
      dist = pointToArcDist(x, y, entity);
    }
    if (dist < minDist) { minDist = dist; found = { ...entity, idx }; }
  });
  return found;
}

function drawDDSTooltip() {
  if (!window.ddsHoveredEntity) return;
  const { x, y } = window.mouseCanvasPos || { x: 0, y: 0 };
  const text = `${window.ddsHoveredEntity.type}: Color ${window.ddsHoveredEntity.color}`;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#222';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x + 12, y + 8);
  ctx.fillText(text, x + 12, y + 8);
  ctx.restore();
}


