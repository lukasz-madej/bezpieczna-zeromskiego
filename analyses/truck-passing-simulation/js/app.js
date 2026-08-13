(() => {
  "use strict";

  const root = document.getElementById("zeromskiego-dynamic-pass");
  const svg = root.querySelector("#pass-svg");
  const slider = root.querySelector("#pass-position");
  const threeCanvas = root.querySelector("#three-canvas");
  const threeContext = threeCanvas.getContext("2d");
  const threePlay = root.querySelector("#three-play");
  const threeReset = root.querySelector("#three-reset");
  const threePhase = root.querySelector("#three-phase");
  const positionValue = root.querySelector("#position-value");
  const currentGap = root.querySelector("#current-gap");
  const relativeAngle = root.querySelector("#relative-angle");
  const collisionState = root.querySelector("#collision-state");
  const gapPair = root.querySelector("#gap-pair");
  const status = root.querySelector("#pass-status");
  const tableBody = root.querySelector("#clearance-body");
  const summary = root.querySelector("#truck-summary");
  const ns = "http://www.w3.org/2000/svg";

  const image = new Image();
  image.src = "img/plan-preview.jpg";

  /* Poprzedni, statyczny model pozostaje wyłączony poniżej.
  const crop = { x: 760, y: 210, width: 650, height: 180 };
  const fitted = {
    cxPx: 853.704,
    cyPx: 2982.735,
    pxPerM: 11.48217,
    roadRadiusM: 236.061,
    roadHalfWidthM: 3.0
  };
  const truckPhotoSource = "img/truck-photo.webp";
  const vehicle = {
    widthM: 2.55,
    frontAxleToHitchM: 3.10,
    frontOverhangM: 1.40,
    mirrorBehindFrontM: 0.55,
    trailerHitchToAxlesM: 8.10,
    trailerFrontOverhangM: 1.60,
    trailerRearOverhangM: 3.90
  };

  const fmt = value => {
    if (Math.abs(value) < 0.02) return "≈ 0,00 m";
    if (value < 0) return "–" + Math.abs(value).toFixed(2).replace(".", ",") + " m";
    return value.toFixed(2).replace(".", ",") + " m";
  };

  const css = name => getComputedStyle(root).getPropertyValue(name).trim();
  const point = (r, theta) => ({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  const add = (a, b, factor = 1) => ({ x: a.x + b.x * factor, y: a.y + b.y * factor });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const length = v => Math.hypot(v.x, v.y);
  const unit = v => {
    const d = length(v);
    return { x: v.x / d, y: v.y / d };
  };
  const normal = u => ({ x: -u.y, y: u.x });
  const radius = p => Math.hypot(p.x, p.y);

  const toCanvas = p => ({
    x: (fitted.cxPx + p.x * fitted.pxPerM - crop.x) * 2,
    y: (fitted.cyPx + p.y * fitted.pxPerM - crop.y) * 2
  });

  function polygon(start, end, halfWidth, u) {
    const n = normal(u);
    return [
      add(start, n, halfWidth),
      add(end, n, halfWidth),
      add(end, n, -halfWidth),
      add(start, n, -halfWidth)
    ];
  }

  function buildVehicle(lane, direction, thetaFront, mirrorSpanM) {
    const frontRadius = fitted.roadRadiusM + lane * 1.5;
    const hitchRadius = Math.sqrt(frontRadius ** 2 - vehicle.frontAxleToHitchM ** 2);
    const hitchTheta = thetaFront - direction * Math.asin(vehicle.frontAxleToHitchM / frontRadius);
    const axleRadius = Math.sqrt(hitchRadius ** 2 - vehicle.trailerHitchToAxlesM ** 2);
    const axleTheta = hitchTheta - direction * Math.asin(vehicle.trailerHitchToAxlesM / hitchRadius);

    const frontAxle = point(frontRadius, thetaFront);
    const hitch = point(hitchRadius, hitchTheta);
    const trailerAxles = point(axleRadius, axleTheta);
    const tractorDir = unit(sub(frontAxle, hitch));
    const trailerDir = unit(sub(hitch, trailerAxles));
    const frontMid = add(frontAxle, tractorDir, vehicle.frontOverhangM);
    const tractorRear = add(hitch, tractorDir, -0.60);
    const mirrorMid = add(frontMid, tractorDir, -vehicle.mirrorBehindFrontM);
    const trailerFront = add(hitch, trailerDir, vehicle.trailerFrontOverhangM);
    const trailerRear = add(trailerAxles, trailerDir, -vehicle.trailerRearOverhangM);
    const tractorPoly = polygon(frontMid, tractorRear, vehicle.widthM / 2, tractorDir);
    const trailerPoly = polygon(trailerFront, trailerRear, vehicle.widthM / 2, trailerDir);
    const tractorN = normal(tractorDir);
    const trailerN = normal(trailerDir);
    const mirrors = [
      add(mirrorMid, tractorN, mirrorSpanM / 2),
      add(mirrorMid, tractorN, -mirrorSpanM / 2)
    ];
    const rearCorners = [
      add(trailerRear, trailerN, vehicle.widthM / 2),
      add(trailerRear, trailerN, -vehicle.widthM / 2)
    ];

    return {
      lane,
      tractorPoly,
      trailerPoly,
      mirrors,
      mirrorMid,
      rearCorners,
      trailerRear,
      hitch,
      trailerAxles
    };
  }

  function solveTheta(lane, direction, mirrorSpanM, targetFrontPx) {
    let theta = -1.495;
    for (let i = 0; i < 10; i += 1) {
      const model = buildVehicle(lane, direction, theta, mirrorSpanM);
      const front = model.tractorPoly[0];
      const other = model.tractorPoly[3];
      const frontMidX = (front.x + other.x) / 2;
      const globalPx = fitted.cxPx + frontMidX * fitted.pxPerM;
      const derivative = -Math.sin(theta) * (fitted.roadRadiusM + lane * 1.5) * fitted.pxPerM;
      theta += (targetFrontPx - globalPx) / derivative;
    }
    return theta;
  }

  function clearances(model) {
    const frontR = model.mirrors.map(radius);
    const rearR = model.rearCorners.map(radius);
    const rc = fitted.roadRadiusM;
    if (model.lane > 0) {
      return {
        frontAxis: Math.min(...frontR) - rc,
        frontEdge: rc + 3 - Math.max(...frontR),
        rearAxis: Math.min(...rearR) - rc,
        rearEdge: rc + 3 - Math.max(...rearR)
      };
    }
    return {
      frontAxis: rc - Math.max(...frontR),
      frontEdge: Math.min(...frontR) - (rc - 3),
      rearAxis: rc - Math.max(...rearR),
      rearEdge: Math.min(...rearR) - (rc - 3)
    };
  }

  function drawPath(points, fill, stroke) {
    ctx.beginPath();
    points.map(toCanvas).forEach((p, index) => {
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.globalAlpha = 0.46;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawArc(radiusM, stroke, dashed, width) {
    const c = {
      x: (fitted.cxPx - crop.x) * 2,
      y: (fitted.cyPx - crop.y) * 2
    };
    ctx.beginPath();
    ctx.setLineDash(dashed ? [18, 12] : []);
    ctx.arc(c.x, c.y, radiusM * fitted.pxPerM * 2, -1.62, -1.42);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCrossSection(points, color, width) {
    const a = toCanvas(points[0]);
    const b = toCanvas(points[1]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    [a, b].forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, width * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  function label(text, worldPoint, offsetX, offsetY) {
    const p = toCanvas(worldPoint);
    ctx.font = "500 22px system-ui, sans-serif";
    const pad = 10;
    const w = ctx.measureText(text).width + pad * 2;
    const h = 34;
    const x = Math.max(8, Math.min(canvas.width - w - 8, p.x + offsetX));
    const y = Math.max(8, Math.min(canvas.height - h - 8, p.y + offsetY));
    ctx.globalAlpha = 0.90;
    ctx.fillStyle = css("--card") || "#ffffff";
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = css("--card-foreground") || "#111111";
    ctx.fillText(text, x + pad, y + 24);
  }

  function render() {
    const mirrorSpan = Number(slider.value);
    mirrorValue.textContent = mirrorSpan.toFixed(2).replace(".", ",") + " m";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = css("--background") || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    const foreground = css("--foreground") || "#111111";
    const roadEdge = css("--muted-foreground") || "#555555";
    const outerColor = css("--viz-series-1") || "#2563eb";
    const innerColor = css("--viz-series-2") || "#f97316";
    const mirrorColor = css("--red") || "#dc2626";

    drawArc(fitted.roadRadiusM + 3, roadEdge, true, 5);
    drawArc(fitted.roadRadiusM, foreground, true, 4);
    drawArc(fitted.roadRadiusM - 3, roadEdge, true, 5);

    const outerTheta = solveTheta(1, 1, mirrorSpan, 1060);
    const innerTheta = solveTheta(-1, -1, mirrorSpan, 1060);
    const outer = buildVehicle(1, 1, outerTheta, mirrorSpan);
    const inner = buildVehicle(-1, -1, innerTheta, mirrorSpan);
    const outerC = clearances(outer);
    const innerC = clearances(inner);

    drawPath(outer.trailerPoly, outerColor, outerColor);
    drawPath(outer.tractorPoly, outerColor, outerColor);
    drawPath(inner.trailerPoly, innerColor, innerColor);
    drawPath(inner.tractorPoly, innerColor, innerColor);
    drawCrossSection(outer.mirrors, mirrorColor, 6);
    drawCrossSection(inner.mirrors, mirrorColor, 6);
    drawCrossSection(outer.rearCorners, outerColor, 4);
    drawCrossSection(inner.rearCorners, innerColor, 4);

    label("CZOŁA: odstęp praktycznie 0", outer.mirrorMid, -170, -86);
    label("KONIEC: oś " + fmt(outerC.rearAxis) + " / kraw. " + fmt(outerC.rearEdge), outer.trailerRear, -150, 48);
    label("KONIEC: oś " + fmt(innerC.rearAxis) + " / kraw. " + fmt(innerC.rearEdge), inner.trailerRear, -250, 44);

    tableBody.innerHTML = [
      ["Górny pas - czoło (lusterka)", outerC.frontAxis, outerC.frontEdge],
      ["Górny pas - koniec naczepy", outerC.rearAxis, outerC.rearEdge],
      ["Dolny pas - czoło (lusterka)", innerC.frontAxis, innerC.frontEdge],
      ["Dolny pas - koniec naczepy", innerC.rearAxis, innerC.rearEdge]
    ].map(row => '<tr><td>' + row[0] + '</td><td class="text-end text-nowrap">' + fmt(row[1]) + '</td><td class="text-end text-nowrap">' + fmt(row[2]) + '</td></tr>').join("");

    const meetingGap = outerC.frontAxis + innerC.frontAxis;
    const criticalTrailerCabGap = outerC.rearAxis + innerC.frontAxis;
    summary.textContent = "Przy lusterkach " + mirrorSpan.toFixed(2) + " m odstęp między lusterkami wynosi około " + fmt(meetingGap) + ", a krytyczny odstęp między naczepą na zewnętrznym pasie i kabiną na wewnętrznym pasie około " + fmt(criticalTrailerCabGap) + ".";
    canvas.setAttribute("aria-label", summary.textContent);
  }

  slider.addEventListener("input", render);
  image.addEventListener("load", render);
  if (image.complete) render();
  */

  const planSource = "img/plan.jpg";
  root.querySelector("#plan-image").setAttribute("href", planSource);

  const geometry = {
    centerX: 893.552552,
    centerY: 3558.816078,
    pxPerM: 9.40123595,
    roadRadius: 350,
    roadHalfWidth: 3,
    thetaCenter: -1.5687,
    travel: 34,
    crossfall: 0.02
  };
  const activeTruckPhotoSource = "img/truck-cab-outline.png";
  const vehicle = {
    width: 2.55,
    cabWidth: 2.495,
    mirrorSpan: 3.02,
    frontAxleToHitch: 3.425,
    frontOverhang: 1.555,
    mirrorBehindFront: 0.62,
    hitchToTrailerAxles: 7.70,
    trailerFrontOverhang: 1.62,
    trailerRearOverhang: 4.40,
    cabHeight: 3.72,
    mirrorHeight: 2.78
  };

  const add = (p, v, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const length = v => Math.hypot(v.x, v.y);
  const unit = v => {
    const size = length(v);
    return { x: v.x / size, y: v.y / size };
  };
  const normal = u => ({ x: -u.y, y: u.x });
  const radius = p => Math.hypot(p.x, p.y);
  const clamp = value => Math.max(0, Math.min(1, value));

  function point(circleRadius, theta) {
    return {
      x: circleRadius * Math.cos(theta),
      y: circleRadius * Math.sin(theta)
    };
  }

  function toPlan(p) {
    return {
      x: geometry.centerX + p.x * geometry.pxPerM,
      y: geometry.centerY + p.y * geometry.pxPerM
    };
  }

  function box(front, rear, halfWidth, direction) {
    const n = normal(direction);
    return [
      add(front, n, halfWidth),
      add(rear, n, halfWidth),
      add(rear, n, -halfWidth),
      add(front, n, -halfWidth)
    ];
  }

  function tractorOutline(front, rear, direction) {
    const n = normal(direction);
    const half = vehicle.cabWidth / 2;
    const shoulder = add(front, direction, -0.38);
    return [
      add(front, n, half * 0.80),
      add(shoulder, n, half),
      add(rear, n, half),
      add(rear, n, -half),
      add(shoulder, n, -half),
      add(front, n, -half * 0.80)
    ];
  }

  function buildVehicle(direction, station) {
    const laneOffset = direction > 0 ? -1.5 : 1.5;
    const frontRadius = geometry.roadRadius + laneOffset;
    const thetaFront = geometry.thetaCenter + station / geometry.roadRadius;
    const hitchRadius = Math.sqrt(frontRadius ** 2 - vehicle.frontAxleToHitch ** 2);
    const hitchTheta = thetaFront - direction * Math.asin(vehicle.frontAxleToHitch / frontRadius);
    const axleRadius = Math.sqrt(hitchRadius ** 2 - vehicle.hitchToTrailerAxles ** 2);
    const axleTheta = hitchTheta - direction * Math.asin(vehicle.hitchToTrailerAxles / hitchRadius);
    const frontAxle = point(frontRadius, thetaFront);
    const hitch = point(hitchRadius, hitchTheta);
    const trailerAxles = point(axleRadius, axleTheta);
    const tractorDir = unit(sub(frontAxle, hitch));
    const trailerDir = unit(sub(hitch, trailerAxles));
    const front = add(frontAxle, tractorDir, vehicle.frontOverhang);
    const tractorRear = add(hitch, tractorDir, -0.60);
    const trailerFront = add(hitch, trailerDir, vehicle.trailerFrontOverhang);
    const trailerRear = add(trailerAxles, trailerDir, -vehicle.trailerRearOverhang);
    const mirrorMid = add(front, tractorDir, -vehicle.mirrorBehindFront);
    const tractorN = normal(tractorDir);
    const trailerN = normal(trailerDir);
    const mirrorInner = [
      add(mirrorMid, tractorN, vehicle.cabWidth / 2),
      add(mirrorMid, tractorN, -vehicle.cabWidth / 2)
    ];
    const mirrorTips = [
      add(mirrorMid, tractorN, vehicle.mirrorSpan / 2),
      add(mirrorMid, tractorN, -vehicle.mirrorSpan / 2)
    ];
    const mirrorBodyLength = 0.30;
    const mirrorBodyDepth = 0.20;
    const mirrorBodies = [1, -1].map(side => {
      const center = add(mirrorMid, tractorN, side * (vehicle.mirrorSpan / 2 - mirrorBodyDepth / 2));
      const bodyFront = add(center, tractorDir, mirrorBodyLength / 2);
      const bodyRear = add(center, tractorDir, -mirrorBodyLength / 2);
      return box(bodyFront, bodyRear, mirrorBodyDepth / 2, tractorDir);
    });
    const trailerPoly = box(trailerFront, trailerRear, vehicle.width / 2, trailerDir);
    const tractorPoly = tractorOutline(front, tractorRear, tractorDir);
    const frontCorners = [
      add(trailerFront, trailerN, vehicle.width / 2),
      add(trailerFront, trailerN, -vehicle.width / 2)
    ];
    const rearCorners = [
      add(trailerRear, trailerN, vehicle.width / 2),
      add(trailerRear, trailerN, -vehicle.width / 2)
    ];
    const middleSidePoints = frontCorners.map((frontCorner, index) => ({
      x: (frontCorner.x + rearCorners[index].x) / 2,
      y: (frontCorner.y + rearCorners[index].y) / 2
    }));

    return {
      direction,
      laneOffset,
      tractorDir,
      trailerDir,
      tractorPoly,
      trailerPoly,
      mirrorInner,
      mirrorTips,
      mirrorBodies,
      front,
      frontAxle,
      hitch,
      trailerAxles,
      trailerFront,
      trailerRear,
      frontCorners,
      middleSidePoints,
      rearCorners
    };
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function planPoints(points) {
    return points.map(toPlan).map(p => p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" ");
  }

  function appendLine(group, a, b, className) {
    const p1 = toPlan(a);
    const p2 = toPlan(b);
    group.appendChild(svgElement("line", {
      x1: p1.x.toFixed(2),
      y1: p1.y.toFixed(2),
      x2: p2.x.toFixed(2),
      y2: p2.y.toFixed(2),
      class: className
    }));
  }

  function appendWheel(group, center, direction) {
    const n = normal(direction);
    [-1, 1].forEach(side => {
      const wheelCenter = add(center, n, side * 1.25);
      const wheelPoly = box(
        add(wheelCenter, direction, 0.38),
        add(wheelCenter, direction, -0.38),
        0.13,
        direction
      );
      group.appendChild(svgElement("polygon", {
        points: planPoints(wheelPoly),
        class: "wheel"
      }));
    });
  }

  function appendArrow(group, center, direction) {
    const n = normal(direction);
    const start = add(center, direction, -1.4);
    const tip = add(center, direction, 1.4);
    appendLine(group, start, tip, "direction-mark");
    appendLine(group, tip, add(add(tip, direction, -0.55), n, 0.38), "direction-mark");
    appendLine(group, tip, add(add(tip, direction, -0.55), n, -0.38), "direction-mark");
  }

  function measurementPoints(model, prefix) {
    const sections = [
      { points: model.frontCorners, center: model.trailerFront, label: "czoło naczepy", ids: ["1", "2"] },
      {
        points: model.middleSidePoints,
        center: {
          x: (model.trailerFront.x + model.trailerRear.x) / 2,
          y: (model.trailerFront.y + model.trailerRear.y) / 2
        },
        label: "środek naczepy",
        ids: ["3", "4"]
      },
      { points: model.rearCorners, center: model.trailerRear, label: "koniec naczepy", ids: ["5", "6"] }
    ];

    return sections.flatMap(section => {
      const orderedByRadius = [...section.points].sort((a, b) => radius(a) - radius(b));
      const axisPoint = model.laneOffset > 0 ? orderedByRadius[0] : orderedByRadius[1];
      const edgePoint = model.laneOffset > 0 ? orderedByRadius[1] : orderedByRadius[0];
      const makeItem = (id, side, pointToMeasure) => {
        const outward = unit(sub(pointToMeasure, section.center));
        return {
          id: prefix + id,
          description: section.label + " - strona " + side,
          point: pointToMeasure,
          labelPoint: add(pointToMeasure, outward, 0.78)
        };
      };
      return [
        makeItem(section.ids[0], "osi", axisPoint),
        makeItem(section.ids[1], "krawędzi", edgePoint)
      ];
    });
  }

  function appendMeasurementPoint(group, item) {
    const pointOnPlan = toPlan(item.point);
    const labelPosition = toPlan(item.labelPoint);
    group.appendChild(svgElement("circle", {
      cx: pointOnPlan.x.toFixed(2),
      cy: pointOnPlan.y.toFixed(2),
      r: 6,
      class: "measurement-point"
    }));
    const label = svgElement("text", {
      x: labelPosition.x.toFixed(2),
      y: labelPosition.y.toFixed(2),
      class: "measurement-label",
      "aria-label": "Punkt pomiarowy " + item.id + ", " + item.description
    });
    label.textContent = item.id;
    group.appendChild(label);
  }

  function renderVehicle(group, model, className, prefix) {
    group.replaceChildren();
    group.appendChild(svgElement("polygon", {
      points: planPoints(model.trailerPoly),
      class: "vehicle-part " + className
    }));
    group.appendChild(svgElement("polygon", {
      points: planPoints(model.tractorPoly),
      class: "vehicle-part " + className
    }));
    const windshieldCenter = add(model.front, model.tractorDir, -1.10);
    const windshieldN = normal(model.tractorDir);
    appendLine(group, add(windshieldCenter, windshieldN, 1.02), add(windshieldCenter, windshieldN, -1.02), "cab-detail");
    appendWheel(group, model.frontAxle, model.tractorDir);
    appendWheel(group, add(model.hitch, model.tractorDir, -0.42), model.tractorDir);
    [-0.65, 0, 0.65].forEach(offset => appendWheel(group, add(model.trailerAxles, model.trailerDir, offset), model.trailerDir));
    appendLine(group, model.mirrorInner[0], model.mirrorTips[0], "mirror-arm");
    appendLine(group, model.mirrorInner[1], model.mirrorTips[1], "mirror-arm");
    model.mirrorBodies.forEach(body => {
      group.appendChild(svgElement("polygon", {
        points: planPoints(body),
        class: "mirror-body"
      }));
    });
    const hitchPoint = toPlan(model.hitch);
    group.appendChild(svgElement("circle", {
      cx: hitchPoint.x.toFixed(2),
      cy: hitchPoint.y.toFixed(2),
      r: 4,
      class: "hitch"
    }));
    const trailerCenter = {
      x: (model.trailerFront.x + model.trailerRear.x) / 2,
      y: (model.trailerFront.y + model.trailerRear.y) / 2
    };
    appendArrow(group, trailerCenter, model.trailerDir);
    measurementPoints(model, prefix).forEach(item => appendMeasurementPoint(group, item));
  }

  function polygonSegments(points) {
    return points.map((pointA, index) => ({
      a: pointA,
      b: points[(index + 1) % points.length]
    }));
  }

  function vehicleParts(model) {
    return [
      { polygon: model.tractorPoly, label: "ciągnik" },
      { polygon: model.trailerPoly, label: "naczepa" },
      ...model.mirrorBodies.map(body => ({ polygon: body, label: "lusterko" }))
    ];
  }

  function closestPointToSegment(pointA, segmentA, segmentB) {
    const ab = sub(segmentB, segmentA);
    const denominator = dot(ab, ab);
    const t = denominator === 0 ? 0 : clamp(dot(sub(pointA, segmentA), ab) / denominator);
    const pointB = add(segmentA, ab, t);
    return { distance: length(sub(pointA, pointB)), pointA, pointB };
  }

  function closestSegments(a, b, c, d) {
    const r = sub(b, a);
    const s = sub(d, c);
    const denominator = cross(r, s);
    if (Math.abs(denominator) > 1e-9) {
      const t = cross(sub(c, a), s) / denominator;
      const u = cross(sub(c, a), r) / denominator;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const meeting = add(a, r, t);
        return { distance: 0, pointA: meeting, pointB: meeting };
      }
    }
    const candidates = [
      closestPointToSegment(a, c, d),
      closestPointToSegment(b, c, d),
      (() => {
        const result = closestPointToSegment(c, a, b);
        return { distance: result.distance, pointA: result.pointB, pointB: result.pointA };
      })(),
      (() => {
        const result = closestPointToSegment(d, a, b);
        return { distance: result.distance, pointA: result.pointB, pointB: result.pointA };
      })()
    ];
    return candidates.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
  }

  function polygonCenter(polygon) {
    const sum = polygon.reduce((total, pointToAdd) => add(total, pointToAdd), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }

  function polygonAxes(polygon) {
    return polygonSegments(polygon).map(segment => unit(normal(sub(segment.b, segment.a))));
  }

  function projection(polygon, axis) {
    const values = polygon.map(pointToProject => dot(pointToProject, axis));
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  function supportPoint(polygon, axis, maximize) {
    return polygon.reduce((best, candidate) => {
      const bestValue = dot(best, axis);
      const candidateValue = dot(candidate, axis);
      return maximize ? (candidateValue > bestValue ? candidate : best) : (candidateValue < bestValue ? candidate : best);
    });
  }

  function polygonSignedGap(polygonA, polygonB) {
    const axes = [...polygonAxes(polygonA), ...polygonAxes(polygonB)];
    let separated = false;
    let penetration = Infinity;
    let penetrationAxis = axes[0];

    axes.forEach(axisCandidate => {
      const projectedA = projection(polygonA, axisCandidate);
      const projectedB = projection(polygonB, axisCandidate);
      if (projectedA.max < projectedB.min || projectedB.max < projectedA.min) {
        separated = true;
        return;
      }
      const depth = Math.min(projectedA.max - projectedB.min, projectedB.max - projectedA.min);
      if (depth < penetration) {
        penetration = depth;
        penetrationAxis = axisCandidate;
      }
    });

    if (separated) {
      let closest = { value: Infinity, pointA: polygonA[0], pointB: polygonB[0] };
      polygonSegments(polygonA).forEach(segmentA => {
        polygonSegments(polygonB).forEach(segmentB => {
          const result = closestSegments(segmentA.a, segmentA.b, segmentB.a, segmentB.b);
          if (result.distance < closest.value) {
            closest = { value: result.distance, pointA: result.pointA, pointB: result.pointB };
          }
        });
      });
      return closest;
    }

    const centerDirection = sub(polygonCenter(polygonB), polygonCenter(polygonA));
    if (dot(centerDirection, penetrationAxis) < 0) {
      penetrationAxis = add({ x: 0, y: 0 }, penetrationAxis, -1);
    }
    return {
      value: -penetration,
      pointA: supportPoint(polygonA, penetrationAxis, true),
      pointB: supportPoint(polygonB, penetrationAxis, false)
    };
  }

  function signedVehicleGap(modelA, modelB) {
    let nearestClearance = { value: Infinity, pointA: modelA.front, pointB: modelB.front, labelA: "ciągnik", labelB: "ciągnik" };
    let deepestCollision = null;
    vehicleParts(modelA).forEach(partA => {
      vehicleParts(modelB).forEach(partB => {
        const result = polygonSignedGap(partA.polygon, partB.polygon);
        const labeled = { ...result, labelA: partA.label, labelB: partB.label };
        if (result.value < 0) {
          if (!deepestCollision || result.value < deepestCollision.value) deepestCollision = labeled;
        } else if (result.value < nearestClearance.value) {
          nearestClearance = labeled;
        }
      });
    });
    return deepestCollision || nearestClearance;
  }

  function pointInsidePolygon(pointToTest, polygon) {
    let inside = false;
    polygon.forEach((vertexA, index) => {
      const vertexB = polygon[(index + 1) % polygon.length];
      const crossesRay = (vertexA.y > pointToTest.y) !== (vertexB.y > pointToTest.y);
      if (!crossesRay) return;
      const crossingX = vertexA.x + (pointToTest.y - vertexA.y) * (vertexB.x - vertexA.x) / (vertexB.y - vertexA.y);
      if (pointToTest.x < crossingX) inside = !inside;
    });
    return inside;
  }

  function signedPointToPolygon(pointToMeasure, polygon) {
    let minimum = Infinity;
    polygonSegments(polygon).forEach(segment => {
      const result = closestPointToSegment(pointToMeasure, segment.a, segment.b);
      minimum = Math.min(minimum, result.distance);
    });
    return pointInsidePolygon(pointToMeasure, polygon) ? -minimum : minimum;
  }

  function signedPointToVehicle(pointToMeasure, otherVehicle) {
    const values = vehicleParts(otherVehicle).map(part => signedPointToPolygon(pointToMeasure, part.polygon));
    const penetrations = values.filter(value => value < 0);
    return penetrations.length ? Math.min(...penetrations) : Math.min(...values);
  }

  function signedPointSetToVehicle(points, otherVehicle) {
    const values = points.map(pointToMeasure => signedPointToVehicle(pointToMeasure, otherVehicle));
    const penetrations = values.filter(value => value < 0);
    return penetrations.length ? Math.min(...penetrations) : Math.min(...values);
  }

  function clearances(model) {
    const frontRadii = model.mirrorTips.map(radius);
    const rearRadii = model.rearCorners.map(radius);
    if (model.laneOffset > 0) {
      return {
        frontAxis: Math.min(...frontRadii) - geometry.roadRadius,
        frontEdge: geometry.roadRadius + geometry.roadHalfWidth - Math.max(...frontRadii),
        rearAxis: Math.min(...rearRadii) - geometry.roadRadius,
        rearEdge: geometry.roadRadius + geometry.roadHalfWidth - Math.max(...rearRadii)
      };
    }
    return {
      frontAxis: geometry.roadRadius - Math.max(...frontRadii),
      frontEdge: Math.min(...frontRadii) - (geometry.roadRadius - geometry.roadHalfWidth),
      rearAxis: geometry.roadRadius - Math.max(...rearRadii),
      rearEdge: Math.min(...rearRadii) - (geometry.roadRadius - geometry.roadHalfWidth)
    };
  }

  function pointClearances(model, pointToMeasure) {
    const pointRadius = radius(pointToMeasure);
    if (model.laneOffset > 0) {
      return {
        axis: pointRadius - geometry.roadRadius,
        edge: geometry.roadRadius + geometry.roadHalfWidth - pointRadius
      };
    }
    return {
      axis: geometry.roadRadius - pointRadius,
      edge: pointRadius - (geometry.roadRadius - geometry.roadHalfWidth)
    };
  }

  function formatMeters(value) {
    if (Math.abs(value) < 0.0005) return "0,00 m";
    const sign = value < 0 ? "−" : "+";
    const digits = Math.abs(value) < 0.01 ? 3 : 2;
    return sign + Math.abs(value).toFixed(digits).replace(".", ",") + " m";
  }

  function axisPath() {
    const points = [];
    for (let theta = -1.66; theta <= -1.34; theta += 0.004) {
      const p = toPlan(point(geometry.roadRadius, theta));
      points.push((points.length ? "L" : "M") + p.x.toFixed(2) + "," + p.y.toFixed(2));
    }
    return points.join(" ");
  }

  function acuteAxisAngle(directionA, directionB) {
    const cosine = Math.max(-1, Math.min(1, Math.abs(dot(directionA, directionB))));
    return Math.acos(cosine) * 180 / Math.PI;
  }

  function renderCrossSection(upper, lower, angleDegrees) {
    const crossScale = 110;
    const roadCenterX = 450;
    const roadY = 470;
    const crossfallAngle = -Math.atan(geometry.crossfall) * 180 / Math.PI;
    const cabHalfPx = vehicle.cabWidth * crossScale / 2;
    const cabHeightPx = vehicle.cabHeight * crossScale;
    const upperMirrorRadii = upper.mirrorTips.map(radius);
    const lowerMirrorRadii = lower.mirrorTips.map(radius);
    const upperCenterOffset = (Math.min(...upperMirrorRadii) + Math.max(...upperMirrorRadii)) / 2 - geometry.roadRadius;
    const lowerCenterOffset = (Math.min(...lowerMirrorRadii) + Math.max(...lowerMirrorRadii)) / 2 - geometry.roadRadius;
    const upperCenterX = roadCenterX + upperCenterOffset * crossScale;
    const lowerCenterX = roadCenterX + lowerCenterOffset * crossScale;

    function cabPolygon(centerX, baseY) {
      const roofHalf = cabHalfPx * 0.88;
      const topY = baseY - cabHeightPx;
      return [
        [centerX - roofHalf, topY],
        [centerX + roofHalf, topY],
        [centerX + cabHalfPx, baseY],
        [centerX - cabHalfPx, baseY]
      ].map(pointToJoin => pointToJoin[0].toFixed(1) + "," + pointToJoin[1].toFixed(1)).join(" ");
    }

    function roadYAt(centerX) {
      return roadY - geometry.crossfall * (centerX - roadCenterX);
    }

    function rotatedPoint(centerX, baseY, localX, localY) {
      const angle = crossfallAngle * Math.PI / 180;
      return {
        x: centerX + localX * Math.cos(angle) - localY * Math.sin(angle),
        y: baseY + localX * Math.sin(angle) + localY * Math.cos(angle)
      };
    }

    function drawCrossVehicle(group, centerX, classSuffix, labelText) {
      group.replaceChildren();
      const mirrorHalf = vehicle.mirrorSpan * crossScale / 2;
      const localRoadY = roadYAt(centerX);
      group.setAttribute("transform", "rotate(" + crossfallAngle.toFixed(4) + " " + centerX.toFixed(1) + " " + localRoadY.toFixed(1) + ")");
      group.appendChild(svgElement("image", {
        href: activeTruckPhotoSource,
        x: (centerX - mirrorHalf).toFixed(1),
        y: (localRoadY - cabHeightPx).toFixed(1),
        width: (mirrorHalf * 2).toFixed(1),
        height: cabHeightPx.toFixed(1),
        preserveAspectRatio: "none",
        class: "cross-photo"
      }));
      group.appendChild(svgElement("polygon", {
        points: cabPolygon(centerX, localRoadY),
        class: "cross-cab-" + classSuffix
      }));
      group.appendChild(svgElement("line", {
        x1: (centerX - mirrorHalf).toFixed(1),
        y1: (localRoadY - vehicle.mirrorHeight * crossScale).toFixed(1),
        x2: (centerX + mirrorHalf).toFixed(1),
        y2: (localRoadY - vehicle.mirrorHeight * crossScale).toFixed(1),
        class: "cross-mirror-" + classSuffix
      }));
      if (labelText) {
        const label = svgElement("text", {
          x: centerX.toFixed(1),
          y: (localRoadY - 14).toFixed(1),
          class: "cross-label"
        });
        label.textContent = labelText;
        group.appendChild(label);
      }
    }

    drawCrossVehicle(root.querySelector("#cross-upper"), upperCenterX, "b", "");
    drawCrossVehicle(root.querySelector("#cross-lower"), lowerCenterX, "a", "");

    const upperInnerOffset = Math.min(...upperMirrorRadii) - geometry.roadRadius;
    const lowerInnerOffset = Math.max(...lowerMirrorRadii) - geometry.roadRadius;
    const upperInner = rotatedPoint(upperCenterX, roadYAt(upperCenterX), -vehicle.mirrorSpan * crossScale / 2, -vehicle.mirrorHeight * crossScale);
    const lowerInner = rotatedPoint(lowerCenterX, roadYAt(lowerCenterX), vehicle.mirrorSpan * crossScale / 2, -vehicle.mirrorHeight * crossScale);
    const mirrorGap = upperInnerOffset - lowerInnerOffset;
    const heightDifference = Math.abs(upperInner.y - lowerInner.y) / crossScale;
    const gapGroup = root.querySelector("#cross-gap");
    gapGroup.replaceChildren(svgElement("line", {
      x1: lowerInner.x.toFixed(1),
      y1: lowerInner.y.toFixed(1),
      x2: upperInner.x.toFixed(1),
      y2: upperInner.y.toFixed(1),
      class: "cross-gap-line"
    }));
    root.querySelector("#cross-gap-label").textContent = "lustra: poziomo " + formatMeters(mirrorGap) + " · Δh " + heightDifference.toFixed(2).replace(".", ",") + " m";

    const halfAngle = angleDegrees * Math.PI / 360;
    const lengthPx = 80;
    root.querySelector("#angle-line-a").setAttribute("x2", (720 + lengthPx * Math.cos(halfAngle)).toFixed(1));
    root.querySelector("#angle-line-a").setAttribute("y2", (52 + lengthPx * Math.sin(halfAngle)).toFixed(1));
    root.querySelector("#angle-line-b").setAttribute("x2", (720 - lengthPx * Math.cos(halfAngle)).toFixed(1));
    root.querySelector("#angle-line-b").setAttribute("y2", (52 + lengthPx * Math.sin(halfAngle)).toFixed(1));
    root.querySelector("#angle-label").textContent = angleDegrees.toFixed(2).replace(".", ",") + "°";
  }

  const threeDefaults = { yaw: -0.88, pitch: 0.48, distance: 58 };
  const threeState = {
    yaw: threeDefaults.yaw,
    pitch: threeDefaults.pitch,
    distance: threeDefaults.distance,
    dragging: false,
    pointerX: 0,
    pointerY: 0,
    lower: null,
    upper: null,
    phase: "mijanie",
    gap: 0,
    playing: false,
    previousTime: 0
  };

  const v3Sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const v3Dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const v3Cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  const v3Unit = value => {
    const size = Math.hypot(value.x, value.y, value.z) || 1;
    return { x: value.x / size, y: value.y / size, z: value.z / size };
  };

  function themeColor(name, fallback) {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  function roadElevation(lateral) {
    if (lateral > geometry.roadHalfWidth) {
      return geometry.crossfall * geometry.roadHalfWidth - 0.08 * (lateral - geometry.roadHalfWidth);
    }
    if (lateral < -geometry.roadHalfWidth) {
      return -geometry.crossfall * geometry.roadHalfWidth - 0.08 * (-geometry.roadHalfWidth - lateral);
    }
    return geometry.crossfall * lateral;
  }

  function roadPlanPoint(station, lateral) {
    return point(geometry.roadRadius + lateral, geometry.thetaCenter + station / geometry.roadRadius);
  }

  function scenePoint(planPoint, height = 0) {
    const origin = point(geometry.roadRadius, geometry.thetaCenter);
    const tangent = { x: -Math.sin(geometry.thetaCenter), y: Math.cos(geometry.thetaCenter) };
    const outward = { x: Math.cos(geometry.thetaCenter), y: Math.sin(geometry.thetaCenter) };
    const delta = sub(planPoint, origin);
    const lateral = radius(planPoint) - geometry.roadRadius;
    return {
      x: dot(delta, tangent),
      y: dot(delta, outward),
      z: roadElevation(lateral) + height
    };
  }

  function addFace(faces, points, color, alpha = 1, stroke = true) {
    faces.push({ points, color, alpha, stroke });
  }

  function addPrism(faces, polygon, baseHeight, height, color) {
    const bottom = polygon.map(planPoint => scenePoint(planPoint, baseHeight));
    const top = polygon.map(planPoint => scenePoint(planPoint, baseHeight + height));
    addFace(faces, top, color, 0.96);
    polygon.forEach((unused, index) => {
      const next = (index + 1) % polygon.length;
      addFace(faces, [bottom[index], bottom[next], top[next], top[index]], color, index % 2 ? 0.78 : 0.88);
    });
  }

  function addRoadFaces(faces, startStation, endStation) {
    const roadColor = themeColor("--muted", "#777");
    const shoulderColor = themeColor("--secondary", "#aaa");
    for (let station = startStation; station < endStation; station += 4) {
      const nextStation = Math.min(endStation, station + 4);
      addFace(faces, [
        scenePoint(roadPlanPoint(station, -3), 0),
        scenePoint(roadPlanPoint(nextStation, -3), 0),
        scenePoint(roadPlanPoint(nextStation, 3), 0),
        scenePoint(roadPlanPoint(station, 3), 0)
      ], roadColor, 0.92, false);
      addFace(faces, [
        scenePoint(roadPlanPoint(station, -4), 0),
        scenePoint(roadPlanPoint(nextStation, -4), 0),
        scenePoint(roadPlanPoint(nextStation, -3), 0),
        scenePoint(roadPlanPoint(station, -3), 0)
      ], shoulderColor, 0.88, false);
      addFace(faces, [
        scenePoint(roadPlanPoint(station, 3), 0),
        scenePoint(roadPlanPoint(nextStation, 3), 0),
        scenePoint(roadPlanPoint(nextStation, 4), 0),
        scenePoint(roadPlanPoint(station, 4), 0)
      ], shoulderColor, 0.88, false);
    }

    const lineColor = themeColor("--foreground", "#111");
    for (let station = startStation; station < endStation; station += 8) {
      const nextStation = Math.min(endStation, station + 4);
      addFace(faces, [
        scenePoint(roadPlanPoint(station, -0.055), 0.025),
        scenePoint(roadPlanPoint(nextStation, -0.055), 0.025),
        scenePoint(roadPlanPoint(nextStation, 0.055), 0.025),
        scenePoint(roadPlanPoint(station, 0.055), 0.025)
      ], lineColor, 0.7, false);
    }
    [-3, 3].forEach(lateral => {
      for (let station = startStation; station < endStation; station += 4) {
        const nextStation = Math.min(endStation, station + 4);
        addFace(faces, [
          scenePoint(roadPlanPoint(station, lateral - 0.035), 0.02),
          scenePoint(roadPlanPoint(nextStation, lateral - 0.035), 0.02),
          scenePoint(roadPlanPoint(nextStation, lateral + 0.035), 0.02),
          scenePoint(roadPlanPoint(station, lateral + 0.035), 0.02)
        ], lineColor, 0.52, false);
      }
    });
  }

  function addWheelPair3D(faces, center, direction) {
    const wheelColor = themeColor("--foreground", "#111");
    const wheelNormal = normal(direction);
    [-1, 1].forEach(side => {
      const wheelCenter = add(center, wheelNormal, side * 1.22);
      const wheelPoly = box(
        add(wheelCenter, direction, 0.36),
        add(wheelCenter, direction, -0.36),
        0.15,
        direction
      );
      addPrism(faces, wheelPoly, 0.05, 0.68, wheelColor);
    });
  }

  function addTruck3D(faces, model, color) {
    addPrism(faces, model.trailerPoly, 1.0, 3.0, color);
    addPrism(faces, model.tractorPoly, 0.18, vehicle.cabHeight - 0.18, color);
    model.mirrorBodies.forEach(mirrorBody => addPrism(faces, mirrorBody, vehicle.mirrorHeight - 0.2, 0.4, themeColor("--red", "#b00020")));
    addWheelPair3D(faces, model.frontAxle, model.tractorDir);
    addWheelPair3D(faces, add(model.hitch, model.tractorDir, -0.42), model.tractorDir);
    [-0.65, 0, 0.65].forEach(offset => addWheelPair3D(faces, add(model.trailerAxles, model.trailerDir, offset), model.trailerDir));

    const frontA = model.tractorPoly[0];
    const frontB = model.tractorPoly[model.tractorPoly.length - 1];
    addFace(faces, [
      scenePoint(frontA, 2.05),
      scenePoint(frontB, 2.05),
      scenePoint(frontB, 3.35),
      scenePoint(frontA, 3.35)
    ], themeColor("--background", "#eee"), 0.72);
  }

  function cameraProjector(width, height) {
    const target = { x: 0, y: 0, z: 1.35 };
    const horizontalDistance = threeState.distance * Math.cos(threeState.pitch);
    const camera = {
      x: target.x + horizontalDistance * Math.cos(threeState.yaw),
      y: target.y + horizontalDistance * Math.sin(threeState.yaw),
      z: target.z + threeState.distance * Math.sin(threeState.pitch)
    };
    const forward = v3Unit(v3Sub(target, camera));
    const right = v3Unit(v3Cross(forward, { x: 0, y: 0, z: 1 }));
    const up = v3Unit(v3Cross(right, forward));
    const focal = Math.min(width, height) * 1.16;
    return point3D => {
      const relative = v3Sub(point3D, camera);
      const depth = v3Dot(relative, forward);
      return {
        x: width / 2 + v3Dot(relative, right) * focal / depth,
        y: height * 0.54 - v3Dot(relative, up) * focal / depth,
        depth
      };
    };
  }

  function renderThreeScene(lower, upper, phase, gapValue) {
    threeState.lower = lower;
    threeState.upper = upper;
    threeState.phase = phase;
    threeState.gap = gapValue;
    if (threeCanvas.hidden) return;
    const bounds = threeCanvas.getBoundingClientRect();
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(640, Math.round(bounds.width * density));
    const height = Math.max(330, Math.round(bounds.width * 31 / 60 * density));
    if (threeCanvas.width !== width || threeCanvas.height !== height) {
      threeCanvas.width = width;
      threeCanvas.height = height;
    }

    const context = threeContext;
    context.clearRect(0, 0, width, height);
    context.fillStyle = themeColor("--background", "#fff");
    context.fillRect(0, 0, width, height);

    const faces = [];
    addRoadFaces(faces, -48, 48);
    addTruck3D(faces, lower, themeColor("--viz-series-2", "#1f77b4"));
    addTruck3D(faces, upper, themeColor("--viz-series-1", "#d28b00"));
    const project3D = cameraProjector(width, height);
    const projectedFaces = faces.map(face => {
      const points = face.points.map(project3D);
      return {
        ...face,
        projected: points,
        depth: points.reduce((sum, item) => sum + item.depth, 0) / points.length
      };
    }).filter(face => face.projected.every(item => item.depth > 0.5));

    projectedFaces.sort((a, b) => b.depth - a.depth);
    projectedFaces.forEach(face => {
      context.beginPath();
      face.projected.forEach((screenPoint, index) => {
        if (index === 0) context.moveTo(screenPoint.x, screenPoint.y);
        else context.lineTo(screenPoint.x, screenPoint.y);
      });
      context.closePath();
      context.globalAlpha = face.alpha;
      context.fillStyle = face.color;
      context.fill();
      if (face.stroke) {
        context.globalAlpha = 0.5;
        context.strokeStyle = themeColor("--foreground", "#111");
        context.lineWidth = Math.max(1, density);
        context.stroke();
      }
    });
    context.globalAlpha = 1;

    [
      { model: lower, label: "A →" },
      { model: upper, label: "B ←" }
    ].forEach(item => {
      const labelPosition = project3D(scenePoint(item.model.front, vehicle.cabHeight + 0.45));
      if (labelPosition.depth <= 0.5) return;
      context.font = Math.round(14 * density) + "px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 4 * density;
      context.strokeStyle = themeColor("--background", "#fff");
      context.strokeText(item.label, labelPosition.x, labelPosition.y);
      context.fillStyle = themeColor("--foreground", "#111");
      context.fillText(item.label, labelPosition.x, labelPosition.y);
    });

    const stateText = gapValue < -0.0005 ? "kolizja geometryczna" : gapValue > 0.0005 ? "odstęp " + formatMeters(gapValue) : "styk obrysów";
    threePhase.textContent = "Widok 3D · " + phase + " · " + stateText;
    threeCanvas.setAttribute("aria-label", "Model 3D, etap " + phase + ", " + stateText + ". Jezdnia sześć metrów, pobocze południowe jeden metr, separacja północna jeden metr i droga rowerowa trzy metry.");
  }

  function redrawThreeScene() {
    if (threeState.lower && threeState.upper) {
      renderThreeScene(threeState.lower, threeState.upper, threeState.phase, threeState.gap);
    }
  }

  function setThreePlaying(playing) {
    threeState.playing = playing;
    threeState.previousTime = 0;
    threePlay.setAttribute("aria-pressed", playing ? "true" : "false");
    threePlay.textContent = playing ? "Pauza" : (Number(slider.value) >= 99.95 ? "Odtwórz ponownie" : "Odtwórz mijanie");
    if (playing) requestAnimationFrame(animateThree);
  }

  function animateThree(time) {
    if (!threeState.playing) return;
    if (!threeState.previousTime) threeState.previousTime = time;
    const elapsed = Math.min(50, time - threeState.previousTime);
    threeState.previousTime = time;
    let nextValue = Number(slider.value) + elapsed * 0.0125;
    if (nextValue >= 100) {
      nextValue = 100;
      slider.value = nextValue.toFixed(2);
      renderDynamic();
      setThreePlaying(false);
      return;
    }
    slider.value = nextValue.toFixed(2);
    renderDynamic();
    requestAnimationFrame(animateThree);
  }

  threeCanvas.addEventListener("pointerdown", event => {
    threeState.dragging = true;
    threeState.pointerX = event.clientX;
    threeState.pointerY = event.clientY;
    threeCanvas.classList.add("is-dragging");
    threeCanvas.setPointerCapture(event.pointerId);
  });
  threeCanvas.addEventListener("pointermove", event => {
    if (!threeState.dragging) return;
    const deltaX = event.clientX - threeState.pointerX;
    const deltaY = event.clientY - threeState.pointerY;
    threeState.pointerX = event.clientX;
    threeState.pointerY = event.clientY;
    threeState.yaw -= deltaX * 0.008;
    threeState.pitch = Math.max(0.16, Math.min(1.25, threeState.pitch + deltaY * 0.006));
    redrawThreeScene();
  });
  function stopThreeDrag(event) {
    threeState.dragging = false;
    threeCanvas.classList.remove("is-dragging");
    if (event.pointerId !== undefined && threeCanvas.hasPointerCapture(event.pointerId)) threeCanvas.releasePointerCapture(event.pointerId);
  }
  threeCanvas.addEventListener("pointerup", stopThreeDrag);
  threeCanvas.addEventListener("pointercancel", stopThreeDrag);
  threeCanvas.addEventListener("wheel", event => {
    event.preventDefault();
    threeState.distance = Math.max(28, Math.min(105, threeState.distance * Math.exp(event.deltaY * 0.0012)));
    redrawThreeScene();
  }, { passive: false });
  threeReset.addEventListener("click", () => {
    threeState.yaw = threeDefaults.yaw;
    threeState.pitch = threeDefaults.pitch;
    threeState.distance = threeDefaults.distance;
    redrawThreeScene();
  });
  threePlay.addEventListener("click", () => {
    if (threeState.playing) {
      setThreePlaying(false);
      return;
    }
    if (Number(slider.value) >= 99.95) slider.value = "0";
    setThreePlaying(true);
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(redrawThreeScene).observe(threeCanvas);
  } else {
    window.addEventListener("resize", redrawThreeScene);
  }

  function renderDynamic() {
    const fraction = Number(slider.value) / 100;
    const lowerStation = -geometry.travel + 2 * geometry.travel * fraction;
    const upperStation = geometry.travel - 2 * geometry.travel * fraction;
    const lower = buildVehicle(1, lowerStation);
    const upper = buildVehicle(-1, upperStation);
    const angleDegrees = acuteAxisAngle(lower.tractorDir, upper.tractorDir);
    renderVehicle(root.querySelector("#upper-vehicle"), upper, "upper-part", "B");
    renderVehicle(root.querySelector("#lower-vehicle"), lower, "lower-part", "A");
    renderCrossSection(upper, lower, angleDegrees);

    const nearest = signedVehicleGap(upper, lower);
    const pointA = toPlan(nearest.pointA);
    const pointB = toPlan(nearest.pointB);
    const mark = root.querySelector("#nearest-mark");
    mark.style.display = Math.abs(nearest.value) <= 6 ? "" : "none";
    root.querySelector("#nearest-line").setAttribute("x1", pointA.x.toFixed(2));
    root.querySelector("#nearest-line").setAttribute("y1", pointA.y.toFixed(2));
    root.querySelector("#nearest-line").setAttribute("x2", pointB.x.toFixed(2));
    root.querySelector("#nearest-line").setAttribute("y2", pointB.y.toFixed(2));
    root.querySelector("#nearest-a").setAttribute("cx", pointA.x.toFixed(2));
    root.querySelector("#nearest-a").setAttribute("cy", pointA.y.toFixed(2));
    root.querySelector("#nearest-b").setAttribute("cx", pointB.x.toFixed(2));
    root.querySelector("#nearest-b").setAttribute("cy", pointB.y.toFixed(2));

    const upperClearance = clearances(upper);
    const lowerClearance = clearances(lower);
    const upperMeasurementPoints = measurementPoints(upper, "B");
    const lowerMeasurementPoints = measurementPoints(lower, "A");
    const phase = fraction < 0.33 ? "zbliżanie" : fraction <= 0.67 ? "mijanie" : "oddalanie";
    const pair = nearest.labelA + " ↔ " + nearest.labelB;
    positionValue.textContent = slider.value.replace(".", ",") + "%";
    relativeAngle.textContent = angleDegrees.toFixed(2).replace(".", ",") + "°";
    currentGap.textContent = formatMeters(nearest.value);
    currentGap.classList.toggle("text-destructive", nearest.value < -0.0005);
    collisionState.textContent = nearest.value < -0.0005 ? "Kolizja" : nearest.value > 0.0005 ? "Odstęp" : "Styk";
    collisionState.classList.toggle("text-destructive", nearest.value < -0.0005);
    gapPair.textContent = pair;
    status.textContent = "Etap: " + phase + ". Kąt osi ciągników " + angleDegrees.toFixed(2).replace(".", ",") + "° wynika z geometrii R = 350 m i położenia zestawów, a nie z prędkości. Dla 50 km/h przyspieszenie boczne wynosi 0,056 g. Spadek 2% do wnętrza łuku jest pokazany w przekroju pionowym; nie zmienia obliczeń rzutu z góry. Wartość dodatnia oznacza odstęp, 0,00 m - zetknięcie, a ujemna - geometryczne wejście punktu w obrys drugiego zestawu. Punkty 1–2: czoło naczepy, 3–4: środek, 5–6: koniec; numery nieparzyste są od strony osi jezdni.";

    const rows = [
      ["Górny pas B ← - czoło (lusterka)", upperClearance.frontAxis, upperClearance.frontEdge, signedPointSetToVehicle(upper.mirrorTips, lower)],
      ...upperMeasurementPoints.map(item => {
        const distances = pointClearances(upper, item.point);
        return [item.id + " - B ←, " + item.description, distances.axis, distances.edge, signedPointToVehicle(item.point, lower)];
      }),
      ["Dolny pas A → - czoło (lusterka)", lowerClearance.frontAxis, lowerClearance.frontEdge, signedPointSetToVehicle(lower.mirrorTips, upper)],
      ...lowerMeasurementPoints.map(item => {
        const distances = pointClearances(lower, item.point);
        return [item.id + " - A →, " + item.description, distances.axis, distances.edge, signedPointToVehicle(item.point, upper)];
      })
    ];
    tableBody.innerHTML = rows.map(row =>
      '<tr><td>' + row[0] + '</td><td class="text-end text-nowrap">' + formatMeters(row[1]) + '</td><td class="text-end text-nowrap">' + formatMeters(row[2]) + '</td><td class="text-end text-nowrap' + (row[3] < -0.0005 ? ' text-destructive' : '') + '">' + formatMeters(row[3]) + '</td></tr>'
    ).join("");
    summary.textContent = "Położenie " + slider.value + " procent. Etap " + phase + ". Wskaźnik kolizji " + formatMeters(nearest.value) + ", stan: " + collisionState.textContent + ", para elementów: " + pair + ". Kąt osi ciągników " + angleDegrees.toFixed(2) + " stopnia.";
    svg.setAttribute("aria-label", summary.textContent);
    renderThreeScene(lower, upper, phase, nearest.value);
    const collisionPoint = {
      x: (nearest.pointA.x + nearest.pointB.x) / 2,
      y: (nearest.pointA.y + nearest.pointB.y) / 2
    };
    const threeDetail = { lower, upper, phase, gap: nearest.value, collisionPoint, progress: fraction };
    window.zeromskiegoRealistic3DLatest = threeDetail;
    window.dispatchEvent(new CustomEvent("zeromskiego-realistic-3d-update", { detail: threeDetail }));
    if (!threeState.playing) {
      threePlay.textContent = Number(slider.value) >= 99.95 ? "Odtwórz ponownie" : "Odtwórz mijanie";
    }
  }

  root.querySelector("#project-axis").setAttribute("d", axisPath());
  slider.addEventListener("input", renderDynamic);
  renderDynamic();
})();
