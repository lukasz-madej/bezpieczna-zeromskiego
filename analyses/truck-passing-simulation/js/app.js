(() => {
  "use strict";

  const root = document.getElementById("zeromskiego-dynamic-pass");
  const svg = root.querySelector("#pass-svg");
  const slider = root.querySelector("#pass-position");
  const elements = {
    slider,
    svg,
    threePlay: root.querySelector("#three-play"),
    positionValue: root.querySelector("#position-value"),
    currentGap: root.querySelector("#current-gap"),
    relativeAngle: root.querySelector("#relative-angle"),
    collisionState: root.querySelector("#collision-state"),
    status: root.querySelector("#pass-status"),
    tableBody: root.querySelector("#clearance-body"),
    summary: root.querySelector("#truck-summary"),
    planImage: root.querySelector("#plan-image"),
    projectAxis: root.querySelector("#project-axis"),
    upperVehicle: root.querySelector("#upper-vehicle"),
    lowerVehicle: root.querySelector("#lower-vehicle"),
    nearestMark: root.querySelector("#nearest-mark"),
    nearestLine: root.querySelector("#nearest-line"),
    nearestA: root.querySelector("#nearest-a"),
    nearestB: root.querySelector("#nearest-b"),
    crossUpper: root.querySelector("#cross-upper"),
    crossLower: root.querySelector("#cross-lower"),
    crossGap: root.querySelector("#cross-gap"),
    crossGapLabel: root.querySelector("#cross-gap-label"),
    angleLineA: root.querySelector("#angle-line-a"),
    angleLineB: root.querySelector("#angle-line-b"),
    angleLabel: root.querySelector("#angle-label")
  };
  const ns = "http://www.w3.org/2000/svg";
  const COLLISION_EPSILON = 0.0005;
  const CROSS_SECTION = {
    scale: 110,
    roadCenterX: 450,
    roadY: 470,
    angleOriginX: 720,
    angleOriginY: 32,
    angleLineLength: 80
  };
  const PLAYBACK = {
    repeatThreshold: 99.95,
    percentPerMillisecond: 0.0125,
    maxFrameDelta: 50
  };

  const planSource = "img/plan.jpg";
  elements.planImage.setAttribute("href", planSource);

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
    const crossScale = CROSS_SECTION.scale;
    const roadCenterX = CROSS_SECTION.roadCenterX;
    const roadY = CROSS_SECTION.roadY;
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

    drawCrossVehicle(elements.crossUpper, upperCenterX, "b", "");
    drawCrossVehicle(elements.crossLower, lowerCenterX, "a", "");

    const upperInnerOffset = Math.min(...upperMirrorRadii) - geometry.roadRadius;
    const lowerInnerOffset = Math.max(...lowerMirrorRadii) - geometry.roadRadius;
    const upperInner = rotatedPoint(upperCenterX, roadYAt(upperCenterX), -vehicle.mirrorSpan * crossScale / 2, -vehicle.mirrorHeight * crossScale);
    const lowerInner = rotatedPoint(lowerCenterX, roadYAt(lowerCenterX), vehicle.mirrorSpan * crossScale / 2, -vehicle.mirrorHeight * crossScale);
    const mirrorGap = upperInnerOffset - lowerInnerOffset;
    const heightDifference = Math.abs(upperInner.y - lowerInner.y) / crossScale;
    elements.crossGap.replaceChildren(svgElement("line", {
      x1: lowerInner.x.toFixed(1),
      y1: lowerInner.y.toFixed(1),
      x2: upperInner.x.toFixed(1),
      y2: upperInner.y.toFixed(1),
      class: "cross-gap-line"
    }));
    elements.crossGapLabel.textContent = "lusterka: poziomo " + formatMeters(mirrorGap) + " · Δh " + heightDifference.toFixed(2).replace(".", ",") + " m";

    const halfAngle = angleDegrees * Math.PI / 360;
    const lengthPx = CROSS_SECTION.angleLineLength;
    elements.angleLineA.setAttribute("x2", (CROSS_SECTION.angleOriginX + lengthPx * Math.cos(halfAngle)).toFixed(1));
    elements.angleLineA.setAttribute("y2", (CROSS_SECTION.angleOriginY + lengthPx * Math.sin(halfAngle)).toFixed(1));
    elements.angleLineB.setAttribute("x2", (CROSS_SECTION.angleOriginX - lengthPx * Math.cos(halfAngle)).toFixed(1));
    elements.angleLineB.setAttribute("y2", (CROSS_SECTION.angleOriginY + lengthPx * Math.sin(halfAngle)).toFixed(1));
    elements.angleLabel.textContent = angleDegrees.toFixed(2).replace(".", ",") + "°";
  }

  const playbackState = { playing: false, previousTime: 0 };

  function setThreePlaying(playing) {
    playbackState.playing = playing;
    playbackState.previousTime = 0;
    elements.threePlay.setAttribute("aria-pressed", playing ? "true" : "false");
    elements.threePlay.textContent = playing ? "Pauza" : (Number(slider.value) >= PLAYBACK.repeatThreshold ? "Odtwórz ponownie" : "Odtwórz mijanie");
    if (playing) requestAnimationFrame(animateThree);
  }

  function animateThree(time) {
    if (!playbackState.playing) return;
    if (!playbackState.previousTime) playbackState.previousTime = time;
    const elapsed = Math.min(PLAYBACK.maxFrameDelta, time - playbackState.previousTime);
    playbackState.previousTime = time;
    let nextValue = Number(slider.value) + elapsed * PLAYBACK.percentPerMillisecond;
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

  elements.threePlay.addEventListener("click", () => {
    if (playbackState.playing) {
      setThreePlaying(false);
      return;
    }
    if (Number(slider.value) >= PLAYBACK.repeatThreshold) slider.value = "0";
    setThreePlaying(true);
  });

  function renderDynamic() {
    const fraction = Number(slider.value) / 100;
    const lowerStation = -geometry.travel + 2 * geometry.travel * fraction;
    const upperStation = geometry.travel - 2 * geometry.travel * fraction;
    const lower = buildVehicle(1, lowerStation);
    const upper = buildVehicle(-1, upperStation);
    const angleDegrees = acuteAxisAngle(lower.tractorDir, upper.tractorDir);
    renderVehicle(elements.upperVehicle, upper, "upper-part", "B");
    renderVehicle(elements.lowerVehicle, lower, "lower-part", "A");
    renderCrossSection(upper, lower, angleDegrees);

    const nearest = signedVehicleGap(upper, lower);
    const pointA = toPlan(nearest.pointA);
    const pointB = toPlan(nearest.pointB);
    elements.nearestMark.style.display = Math.abs(nearest.value) <= 6 ? "" : "none";
    elements.nearestLine.setAttribute("x1", pointA.x.toFixed(2));
    elements.nearestLine.setAttribute("y1", pointA.y.toFixed(2));
    elements.nearestLine.setAttribute("x2", pointB.x.toFixed(2));
    elements.nearestLine.setAttribute("y2", pointB.y.toFixed(2));
    elements.nearestA.setAttribute("cx", pointA.x.toFixed(2));
    elements.nearestA.setAttribute("cy", pointA.y.toFixed(2));
    elements.nearestB.setAttribute("cx", pointB.x.toFixed(2));
    elements.nearestB.setAttribute("cy", pointB.y.toFixed(2));

    const upperClearance = clearances(upper);
    const lowerClearance = clearances(lower);
    const upperMeasurementPoints = measurementPoints(upper, "B");
    const lowerMeasurementPoints = measurementPoints(lower, "A");
    const phase = fraction < 0.33 ? "zbliżanie" : fraction <= 0.67 ? "mijanie" : "oddalanie";
    const pair = nearest.labelA + " ↔ " + nearest.labelB;
    elements.positionValue.textContent = slider.value.replace(".", ",") + "%";
    elements.relativeAngle.textContent = angleDegrees.toFixed(2).replace(".", ",") + "°";
    elements.currentGap.textContent = formatMeters(nearest.value);
    elements.currentGap.classList.toggle("text-destructive", nearest.value < -COLLISION_EPSILON);
    elements.collisionState.textContent = nearest.value < -COLLISION_EPSILON ? "Kolizja" : nearest.value > COLLISION_EPSILON ? "Odstęp" : "Styk";
    elements.collisionState.classList.toggle("text-destructive", nearest.value < -COLLISION_EPSILON);
    elements.status.textContent = "Etap: " + phase + ". Kąt osi ciągników " + angleDegrees.toFixed(2).replace(".", ",") + "° wynika z geometrii R = 350 m i położenia zestawów, a nie z prędkości. Dla 50 km/h przyspieszenie boczne wynosi 0,056 g. Spadek 2% do wnętrza łuku jest pokazany w przekroju pionowym; nie zmienia obliczeń rzutu z góry. Wartość dodatnia oznacza odstęp, 0,00 m - zetknięcie, a ujemna - geometryczne wejście punktu w obrys drugiego zestawu. Punkty 1–2: czoło naczepy, 3–4: środek, 5–6: koniec; numery nieparzyste są od strony osi jezdni.";

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
    elements.tableBody.innerHTML = rows.map(row =>
      '<tr><td>' + row[0] + '</td><td class="text-end text-nowrap">' + formatMeters(row[1]) + '</td><td class="text-end text-nowrap">' + formatMeters(row[2]) + '</td><td class="text-end text-nowrap' + (row[3] < -COLLISION_EPSILON ? ' text-destructive' : '') + '">' + formatMeters(row[3]) + '</td></tr>'
    ).join("");
    elements.summary.textContent = "Położenie " + slider.value + " procent. Etap " + phase + ". Wskaźnik kolizji " + formatMeters(nearest.value) + ", stan: " + elements.collisionState.textContent + ", para elementów: " + pair + ". Kąt osi ciągników " + angleDegrees.toFixed(2) + " stopnia.";
    elements.svg.setAttribute("aria-label", elements.summary.textContent);
    const collisionPoint = {
      x: (nearest.pointA.x + nearest.pointB.x) / 2,
      y: (nearest.pointA.y + nearest.pointB.y) / 2
    };
    const threeDetail = { lower, upper, phase, gap: nearest.value, collisionPoint, progress: fraction };
    window.zeromskiegoRealistic3DLatest = threeDetail;
    window.dispatchEvent(new CustomEvent("zeromskiego-realistic-3d-update", { detail: threeDetail }));
    if (!playbackState.playing) {
      elements.threePlay.textContent = Number(slider.value) >= PLAYBACK.repeatThreshold ? "Odtwórz ponownie" : "Odtwórz mijanie";
    }
  }

  elements.projectAxis.setAttribute("d", axisPath());
  elements.slider.addEventListener("input", renderDynamic);
  renderDynamic();
})();
