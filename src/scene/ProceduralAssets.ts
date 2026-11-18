import * as THREE from 'three';
import { Chapter, CHAPTERS, ChapterId, LandmarkKind, Station } from '../curriculum';
import {
  AvatarConfig,
  ROBE_COLOR_OPTIONS,
  SATCHEL_COLOR_OPTIONS,
} from '../game/types';

export const HUB_CENTER = { x: 0, z: 2, radius: 4.65, surfaceY: 0.75 } as const;

export interface BridgeSpan {
  chapterId: ChapterId;
  dirX: number;
  dirZ: number;
  angle: number;
  startDist: number;
  endDist: number;
  halfWidth: number;
  surfaceY: number;
}

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export const ARCHIPELAGO_BRIDGES: BridgeSpan[] = CHAPTERS.map((ch) => {
  const dx = ch.islandPos[0] - HUB_CENTER.x;
  const dz = ch.islandPos[2] - HUB_CENTER.z;
  const dist = Math.hypot(dx, dz);
  return {
    chapterId: ch.id,
    dirX: dx / dist,
    dirZ: dz / dist,
    angle: Math.atan2(dx, dz),
    startDist: 3.6,
    endDist: dist - ch.islandRadius + 1.15,
    halfWidth: 1.4,
    surfaceY: 0.76,
  };
});

export const ARCHIPELAGO_OBSTACLES: CircleObstacle[] = [
  // Central observatory crystal pedestal
  { x: HUB_CENTER.x, z: HUB_CENTER.z, radius: 1.45, height: 4.5 },
  // Central chapter plaza pedestals & every station monument plinth
  ...CHAPTERS.flatMap((ch) => [
    { x: ch.islandPos[0], z: ch.islandPos[2], radius: 1.85, height: 1.5 },
    ...ch.stations.map((st) => ({
      x: ch.islandPos[0] + st.offsetOnIsland[0],
      z: ch.islandPos[2] + st.offsetOnIsland[1],
      radius: 1.4,
      height: 2.6,
    })),
  ]),
];

export interface WalkableSurfaceResult {
  walkable: boolean;
  groundY: number;
  zone: 'hub' | 'bridge' | 'island' | 'void';
  chapterId?: ChapterId;
}

export interface IslandTerrainTextures {
  stoneMap: THREE.CanvasTexture;
  tileMap: THREE.CanvasTexture;
  goldMap: THREE.CanvasTexture;
}

export function createProceduralTextures(maxAniso: number): IslandTerrainTextures {
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 256;
  stoneCanvas.height = 256;
  const sCtx = stoneCanvas.getContext('2d')!;
  sCtx.fillStyle = '#EFE9DC';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 19341.123) % 1;
    const px = Math.abs(x) * 256;
    const py = Math.abs(y) * 256;
    sCtx.fillStyle = i % 3 === 0 ? 'rgba(195,182,158,0.22)' : 'rgba(255,252,245,0.28)';
    sCtx.fillRect(px, py, 3, 3);
  }
  const stoneMap = new THREE.CanvasTexture(stoneCanvas);
  stoneMap.colorSpace = THREE.SRGBColorSpace;
  stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
  stoneMap.repeat.set(3, 3);
  stoneMap.anisotropy = Math.min(4, maxAniso);

  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = 256;
  tileCanvas.height = 256;
  const tCtx = tileCanvas.getContext('2d')!;
  tCtx.fillStyle = '#E6DFD1';
  tCtx.fillRect(0, 0, 256, 256);
  tCtx.strokeStyle = 'rgba(160, 142, 108, 0.35)';
  tCtx.lineWidth = 2;
  for (let g = 0; g <= 256; g += 64) {
    tCtx.beginPath();
    tCtx.moveTo(g, 0);
    tCtx.lineTo(g, 256);
    tCtx.stroke();
    tCtx.beginPath();
    tCtx.moveTo(0, g);
    tCtx.lineTo(256, g);
    tCtx.stroke();
  }
  // Subtle geometric 8-point star motif in center of tiles
  tCtx.strokeStyle = 'rgba(200, 146, 43, 0.28)';
  tCtx.lineWidth = 1.5;
  for (let gx = 32; gx < 256; gx += 64) {
    for (let gy = 32; gy < 256; gy += 64) {
      tCtx.strokeRect(gx - 12, gy - 12, 24, 24);
      tCtx.save();
      tCtx.translate(gx, gy);
      tCtx.rotate(Math.PI / 4);
      tCtx.strokeRect(-12, -12, 24, 24);
      tCtx.restore();
    }
  }
  const tileMap = new THREE.CanvasTexture(tileCanvas);
  tileMap.colorSpace = THREE.SRGBColorSpace;
  tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping;
  tileMap.repeat.set(4, 4);
  tileMap.anisotropy = Math.min(4, maxAniso);

  const goldCanvas = document.createElement('canvas');
  goldCanvas.width = 128;
  goldCanvas.height = 128;
  const gCtx = goldCanvas.getContext('2d')!;
  const grad = gCtx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#E6BA5C');
  grad.addColorStop(0.5, '#C8922B');
  grad.addColorStop(1, '#F1CE7C');
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, 128, 128);
  const goldMap = new THREE.CanvasTexture(goldCanvas);
  goldMap.colorSpace = THREE.SRGBColorSpace;
  goldMap.anisotropy = Math.min(4, maxAniso);

  return { stoneMap, tileMap, goldMap };
}

export function islandSurfaceHeight(localX: number, localZ: number, radius: number): number {
  const r = Math.hypot(localX, localZ);
  if (r > radius) return -1;
  const norm = r / radius;
  const dome = Math.cos(norm * Math.PI * 0.5) * 0.45;
  return 0.75 + dome;
}

export function getWalkableSurfaceAt(x: number, z: number): WalkableSurfaceResult {
  // 1. Check Chapter Islands (slightly generous rim margin for seamless bridge step)
  for (const ch of CHAPTERS) {
    const lx = x - ch.islandPos[0];
    const lz = z - ch.islandPos[2];
    const r = Math.hypot(lx, lz);
    if (r <= ch.islandRadius - 0.35) {
      const sy = islandSurfaceHeight(lx, lz, ch.islandRadius);
      return {
        walkable: true,
        groundY: ch.islandPos[1] + Math.max(0.75, sy),
        zone: 'island',
        chapterId: ch.id,
      };
    }
  }

  // 2. Check Central Hub
  const hubDist = Math.hypot(x - HUB_CENTER.x, z - HUB_CENTER.z);
  if (hubDist <= HUB_CENTER.radius) {
    return {
      walkable: true,
      groundY: HUB_CENTER.surfaceY,
      zone: 'hub',
    };
  }

  // 3. Check Walkable Bridges
  const relX = x - HUB_CENTER.x;
  const relZ = z - HUB_CENTER.z;
  for (const b of ARCHIPELAGO_BRIDGES) {
    const along = relX * b.dirX + relZ * b.dirZ;
    if (along >= b.startDist - 0.35 && along <= b.endDist + 0.35) {
      const perp = Math.abs(relX * b.dirZ - relZ * b.dirX);
      if (perp <= b.halfWidth - 0.18) {
        return {
          walkable: true,
          groundY: b.surfaceY,
          zone: 'bridge',
          chapterId: b.chapterId,
        };
      }
    }
  }

  return { walkable: false, groundY: -1, zone: 'void' };
}

export function pushOutOfObstacles(x: number, z: number, playerRadius = 0.42): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const obs of ARCHIPELAGO_OBSTACLES) {
    const dx = px - obs.x;
    const dz = pz - obs.z;
    const d = Math.hypot(dx, dz);
    const minDist = obs.radius + playerRadius;
    if (d < minDist) {
      if (d < 0.0001) {
        pz += minDist;
      } else {
        px = obs.x + (dx / d) * minDist;
        pz = obs.z + (dz / d) * minDist;
      }
    }
  }
  return { x: px, z: pz };
}

export function resolveWalkableMovement(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number
): { x: number; z: number; surface: WalkableSurfaceResult; blockedByEdge: boolean } {
  const pushed = pushOutOfObstacles(nextX, nextZ);
  const direct = getWalkableSurfaceAt(pushed.x, pushed.z);
  if (direct.walkable) {
    return { x: pushed.x, z: pushed.z, surface: direct, blockedByEdge: false };
  }

  // Slide cleanly along X or Z axis so edges feel like gentle guardrails
  const slideX = pushOutOfObstacles(nextX, prevZ);
  const surfX = getWalkableSurfaceAt(slideX.x, slideX.z);
  if (surfX.walkable) {
    return { x: slideX.x, z: slideX.z, surface: surfX, blockedByEdge: true };
  }

  const slideZ = pushOutOfObstacles(prevX, nextZ);
  const surfZ = getWalkableSurfaceAt(slideZ.x, slideZ.z);
  if (surfZ.walkable) {
    return { x: slideZ.x, z: slideZ.z, surface: surfZ, blockedByEdge: true };
  }

  const fallback = getWalkableSurfaceAt(prevX, prevZ);
  if (fallback.walkable) {
    return { x: prevX, z: prevZ, surface: fallback, blockedByEdge: true };
  }

  return {
    x: HUB_CENTER.x,
    z: HUB_CENTER.z + 2.2,
    surface: { walkable: true, groundY: HUB_CENTER.surfaceY, zone: 'hub' },
    blockedByEdge: true,
  };
}

export function getNearestSafeWalkablePoint(x: number, z: number): { x: number; y: number; z: number } {
  const current = getWalkableSurfaceAt(x, z);
  if (current.walkable) {
    const pushed = pushOutOfObstacles(x, z);
    const recheck = getWalkableSurfaceAt(pushed.x, pushed.z);
    if (recheck.walkable) {
      return { x: pushed.x, y: recheck.groundY, z: pushed.z };
    }
  }

  // Snap to closest island interior or central hub
  let best: { x: number; y: number; z: number } = {
    x: HUB_CENTER.x,
    y: HUB_CENTER.surfaceY,
    z: HUB_CENTER.z + 2.2,
  };
  let bestDist = Math.hypot(x - best.x, z - best.z);

  for (const ch of CHAPTERS) {
    const dx = x - ch.islandPos[0];
    const dz = z - ch.islandPos[2];
    const d = Math.hypot(dx, dz);
    if (d < bestDist) {
      bestDist = d;
      const clampedR = Math.min(d, ch.islandRadius - 1.5);
      const nx = d > 0.01 ? ch.islandPos[0] + (dx / d) * clampedR : ch.islandPos[0];
      const nz = d > 0.01 ? ch.islandPos[2] + (dz / d) * clampedR : ch.islandPos[2] + 2.2;
      const pushed = pushOutOfObstacles(nx, nz);
      const sy = islandSurfaceHeight(pushed.x - ch.islandPos[0], pushed.z - ch.islandPos[2], ch.islandRadius);
      best = { x: pushed.x, y: ch.islandPos[1] + Math.max(0.75, sy), z: pushed.z };
    }
  }
  return best;
}

export function buildIslandGroup(
  chapter: Chapter,
  textures: IslandTerrainTextures
): THREE.Group {
  const group = new THREE.Group();
  group.name = `island_${chapter.id}`;
  const R = chapter.islandRadius;

  const topMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(chapter.stoneHex),
    map: textures.tileMap,
    roughness: 0.78,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4c8b4,
    map: textures.stoneMap,
    roughness: 0.85,
    metalness: 0.05,
  });
  const underRockMat = new THREE.MeshStandardMaterial({
    color: 0x8f8372,
    roughness: 0.92,
    metalness: 0.02,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(chapter.accentHex),
    roughness: 0.42,
    metalness: 0.25,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    map: textures.goldMap,
    roughness: 0.28,
    metalness: 0.78,
  });

  // 1. Main island deck cylinder
  const deckGeo = new THREE.CylinderGeometry(R, R * 0.95, 1.4, 36, 1);
  const deck = new THREE.Mesh(deckGeo, topMat);
  deck.position.y = 0.2;
  deck.receiveShadow = true;
  deck.castShadow = true;
  group.add(deck);

  // 2. Sculpted outer cornice ring
  const rimGeo = new THREE.CylinderGeometry(R * 1.02, R * 0.98, 0.35, 36);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.72;
  rim.receiveShadow = true;
  rim.castShadow = true;
  group.add(rim);

  // 3. Accent inlaid terrace ring
  const inlayGeo = new THREE.RingGeometry(R * 0.36, R * 0.42, 36);
  inlayGeo.rotateX(-Math.PI / 2);
  const inlay = new THREE.Mesh(inlayGeo, accentMat);
  inlay.position.y = 0.92;
  inlay.receiveShadow = true;
  group.add(inlay);

  // 4. Tapered floating rock underside
  const coneGeo = new THREE.ConeGeometry(R * 0.93, R * 0.62, 16);
  coneGeo.rotateX(Math.PI);
  const cone = new THREE.Mesh(coneGeo, underRockMat);
  cone.position.y = -R * 0.31 - 0.48;
  cone.castShadow = true;
  group.add(cone);

  // 5. Secondary underside spire crystal
  const crystalGeo = new THREE.OctahedronGeometry(1.1, 0);
  const crystal = new THREE.Mesh(crystalGeo, accentMat);
  crystal.scale.set(1, 2.2, 1);
  crystal.position.y = -R * 0.66 - 0.4;
  group.add(crystal);

  // 6. Central chapter pavilion pedestal
  const plazaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.4, 0.36, 8),
    rimMat
  );
  plazaBase.position.y = 1.06;
  plazaBase.receiveShadow = true;
  plazaBase.castShadow = true;
  group.add(plazaBase);

  const plazaCap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.8, 0.16, 8),
    goldMat
  );
  plazaCap.position.y = 1.3;
  plazaCap.castShadow = true;
  group.add(plazaCap);

  // 7. Decorative path segments linking plaza to stations
  chapter.stations.forEach((st) => {
    const [sx, sz] = st.offsetOnIsland;
    const dist = Math.hypot(sx, sz);
    if (dist > 0.5) {
      const pathGeo = new THREE.BoxGeometry(0.45, 0.08, dist);
      const pathMesh = new THREE.Mesh(pathGeo, rimMat);
      pathMesh.position.set(sx * 0.5, 0.91, sz * 0.5);
      pathMesh.rotation.y = Math.atan2(sx, sz);
      pathMesh.receiveShadow = true;
      group.add(pathMesh);
    }
  });

  return group;
}

export interface StationVisualRig {
  root: THREE.Group;
  hitTarget: THREE.Mesh;
  beaconRing: THREE.Mesh;
  haloMesh: THREE.Mesh;
  parts: THREE.Object3D[];
  beaconMaterial: THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
}

function makeSubMaterials(accentHex: string, goldMap: THREE.CanvasTexture) {
  const marble = new THREE.MeshStandardMaterial({
    color: 0xf7f2e8,
    roughness: 0.45,
    metalness: 0.08,
  });
  const sandstone = new THREE.MeshStandardMaterial({
    color: 0xdccbb0,
    roughness: 0.72,
    metalness: 0.05,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.32,
    metalness: 0.35,
  });
  const gold = new THREE.MeshStandardMaterial({
    map: goldMap,
    roughness: 0.25,
    metalness: 0.82,
  });
  const crystal = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    emissive: new THREE.Color(accentHex),
    emissiveIntensity: 0.22,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const darkBronze = new THREE.MeshStandardMaterial({
    color: 0x3b352c,
    roughness: 0.48,
    metalness: 0.65,
  });
  return { marble, sandstone, accent, gold, crystal, darkBronze };
}

function buildLandmarkGeometryParts(
  kind: LandmarkKind,
  accentHex: string,
  goldMap: THREE.CanvasTexture
): THREE.Object3D[] {
  const m = makeSubMaterials(accentHex, goldMap);
  const parts: THREE.Object3D[] = [];

  const add = (mesh: THREE.Object3D) => {
    mesh.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    parts.push(mesh);
  };

  switch (kind) {
    case 'dome_observatory': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.38, 8), m.sandstone);
      base.position.y = 0.19;
      add(base);

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.88, 0.85, 8), m.marble);
      drum.position.y = 0.8;
      add(drum);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.84, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        m.accent
      );
      dome.position.y = 1.22;
      add(dome);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 8), m.gold);
      spire.position.y = 2.3;
      add(spire);
      break;
    }

    case 'wings_monument': {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.28, 0.35, 8), m.marble);
      plinth.position.y = 0.175;
      add(plinth);

      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), m.crystal);
      core.scale.set(1, 1.6, 1);
      core.position.y = 1.25;
      add(core);

      for (const side of [-1, 1]) {
        const wingGroup = new THREE.Group();
        wingGroup.position.set(side * 0.55, 1.15, 0);
        wingGroup.rotation.z = side * -0.28;
        for (let f = 0; f < 3; f++) {
          const feather = new THREE.Mesh(
            new THREE.BoxGeometry(0.85 - f * 0.15, 0.22, 0.12),
            f === 0 ? m.gold : m.marble
          );
          feather.position.set(side * (0.35 + f * 0.08), f * 0.28, 0);
          feather.rotation.z = side * (0.2 + f * 0.14);
          wingGroup.add(feather);
        }
        add(wingGroup);
      }
      break;
    }

    case 'throne_pillars': {
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.32, 8), m.sandstone);
      dais.position.y = 0.16;
      add(dais);

      const pillarsGroup = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.35, 8), m.marble);
        p.position.set(Math.cos(angle) * 0.95, 0.98, Math.sin(angle) * 0.95);
        pillarsGroup.add(p);
      }
      add(pillarsGroup);

      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.22, 8), m.gold);
      canopy.position.y = 1.72;
      add(canopy);

      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), m.crystal);
      orb.position.y = 2.15;
      add(orb);
      break;
    }

    case 'house_mamur': {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 2.1), m.sandstone);
      step.position.y = 0.14;
      add(step);

      const cube = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), m.darkBronze);
      cube.position.y = 0.95;
      add(cube);

      const band = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 1.4), m.gold);
      band.position.y = 1.35;
      add(band);

      const haloCrown = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 24), m.crystal);
      haloCrown.rotation.x = Math.PI / 2;
      haloCrown.position.y = 1.95;
      add(haloCrown);
      break;
    }

    case 'messenger_pillars': {
      const step = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.38, 0.28, 12), m.sandstone);
      step.position.y = 0.14;
      add(step);

      const heights = [0.9, 1.25, 1.65, 1.25, 0.9];
      heights.forEach((h, idx) => {
        const ang = (idx / heights.length) * Math.PI * 2;
        const r = idx === 2 ? 0 : 0.78;
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.28), idx === 2 ? m.gold : m.marble);
        col.position.set(Math.cos(ang) * r, 0.28 + h / 2, Math.sin(ang) * r);
        add(col);
      });
      break;
    }

    case 'paths_bridge': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 1.6), m.sandstone);
      base.position.y = 0.14;
      add(base);

      const leftTower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.45, 8), m.marble);
      leftTower.position.set(-0.65, 0.95, 0);
      add(leftTower);

      const rightTower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.45, 8), m.marble);
      rightTower.position.set(0.65, 0.95, 0);
      add(rightTower);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 0.45), m.gold);
      beam.position.y = 1.72;
      add(beam);
      break;
    }

    case 'shield_crest': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.32, 8), m.sandstone);
      base.position.y = 0.16;
      add(base);

      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 0.22, 6), m.accent);
      shield.rotation.x = Math.PI / 2;
      shield.position.y = 1.18;
      add(shield);

      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), m.gold);
      boss.position.set(0, 1.18, 0.14);
      add(boss);
      break;
    }

    case 'sects_tribunal': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.3, 8), m.marble);
      base.position.y = 0.15;
      add(base);

      const centerStele = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.65, 0.24), m.gold);
      centerStele.position.y = 1.1;
      add(centerStele);

      const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.2), m.darkBronze);
      sideA.position.set(-0.72, 0.82, 0.15);
      sideA.rotation.y = 0.3;
      add(sideA);

      const sideB = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.2), m.darkBronze);
      sideB.position.set(0.72, 0.82, 0.15);
      sideB.rotation.y = -0.3;
      add(sideB);
      break;
    }

    case 'scrolls_timeline': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 1.4), m.sandstone);
      base.position.y = 0.14;
      add(base);

      for (let i = 0; i < 6; i++) {
        const h = 0.55 + i * 0.2;
        const ped = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.16, h, 8),
          i === 5 ? m.gold : m.marble
        );
        ped.position.set(-0.9 + i * 0.36, 0.28 + h / 2, (i % 2 === 0 ? -0.18 : 0.18));
        add(ped);

        const scroll = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.28, 10),
          i === 5 ? m.crystal : m.accent
        );
        scroll.rotation.z = Math.PI / 2;
        scroll.position.set(-0.9 + i * 0.36, 0.35 + h, (i % 2 === 0 ? -0.18 : 0.18));
        add(scroll);
      }
      break;
    }

    case 'manuscript_ark': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.3, 8), m.sandstone);
      base.position.y = 0.15;
      add(base);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 0.85, 8), m.darkBronze);
      stand.position.y = 0.72;
      add(stand);

      const folio = new THREE.Group();
      folio.position.y = 1.28;
      const leftPage = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.85), m.marble);
      leftPage.position.x = -0.32;
      leftPage.rotation.z = 0.28;
      const rightPage = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.85), m.marble);
      rightPage.position.x = 0.32;
      rightPage.rotation.z = -0.28;
      folio.add(leftPage, rightPage);
      add(folio);

      const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.05, 8, 24), m.gold);
      shieldRing.position.y = 1.3;
      shieldRing.rotation.x = Math.PI * 0.35;
      add(shieldRing);
      break;
    }

    case 'scales_wisdom': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.22, 0.32, 8), m.sandstone);
      base.position.y = 0.16;
      add(base);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.65, 10), m.gold);
      post.position.y = 1.1;
      add(post);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.1), m.gold);
      beam.position.y = 1.88;
      add(beam);

      for (const sx of [-0.72, 0.72]) {
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.14, 12), m.accent);
        pan.position.set(sx, 1.25, 0);
        add(pan);
      }
      break;
    }

    case 'miracle_prism': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.3, 8), m.marble);
      base.position.y = 0.15;
      add(base);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 24), m.gold);
      ring.position.y = 1.28;
      add(ring);

      const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), m.crystal);
      prism.scale.set(1, 1.5, 1);
      prism.position.y = 1.28;
      add(prism);
      break;
    }

    case 'twin_gardens': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.3, 12), m.sandstone);
      base.position.y = 0.15;
      add(base);

      const lushCanopy = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), m.accent);
      lushCanopy.position.set(-0.48, 1.15, 0);
      add(lushCanopy);

      const stoneStele = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.25, 6), m.darkBronze);
      stoneStele.position.set(0.52, 0.92, 0);
      add(stoneStele);

      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 20, Math.PI), m.gold);
      arch.position.y = 1.45;
      add(arch);
      break;
    }

    case 'trumpet_spire': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.32, 8), m.sandstone);
      base.position.y = 0.16;
      add(base);

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.65, 14, 1, true), m.gold);
      horn.rotation.z = -0.45;
      horn.rotation.x = Math.PI;
      horn.position.set(0.15, 1.35, 0);
      add(horn);

      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.1, 8), m.marble);
      support.position.y = 0.85;
      add(support);
      break;
    }

    case 'sirat_bridge': {
      const bankA = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 1.2), m.sandstone);
      bankA.position.set(-0.85, 0.325, 0);
      add(bankA);

      const bankB = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 1.2), m.sandstone);
      bankB.position.set(0.85, 0.325, 0);
      add(bankB);

      const archBridge = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.12, 0.24),
        m.gold
      );
      archBridge.position.y = 0.88;
      add(archBridge);

      const lightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.35, 8), m.crystal);
      lightPillar.position.set(0.85, 1.3, 0);
      add(lightPillar);
      break;
    }

    case 'intercession_gate': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 1.4), m.sandstone);
      base.position.y = 0.14;
      add(base);

      for (const sx of [-0.68, 0.68]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.65, 10), m.marble);
        col.position.set(sx, 1.1, 0);
        add(col);
      }

      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.13, 8, 20, Math.PI), m.gold);
      arch.position.y = 1.85;
      add(arch);
      break;
    }

    case 'signs_sundial': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.38, 0.28, 16), m.marble);
      base.position.y = 0.14;
      add(base);

      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 24), m.accent);
      ring1.rotation.x = Math.PI / 2;
      ring1.position.y = 0.35;
      add(ring1);

      const gnomon = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.45, 6), m.gold);
      gnomon.position.y = 0.98;
      gnomon.rotation.x = 0.22;
      add(gnomon);
      break;
    }

    case 'tablet_pen': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.3, 8), m.sandstone);
      base.position.y = 0.15;
      add(base);

      const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.45, 0.18), m.marble);
      tablet.position.set(-0.22, 1.05, 0);
      add(tablet);

      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.55, 8), m.gold);
      pen.position.set(0.55, 1.15, 0.18);
      pen.rotation.z = 0.36;
      add(pen);
      break;
    }

    case 'will_rings': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.3, 8), m.sandstone);
      base.position.y = 0.15;
      add(base);

      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.07, 10, 28), m.gold);
      outerRing.position.y = 1.28;
      outerRing.rotation.y = 0.5;
      add(outerRing);

      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 10, 24), m.accent);
      innerRing.position.y = 1.28;
      innerRing.rotation.x = 0.7;
      add(innerRing);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), m.crystal);
      core.position.y = 1.28;
      add(core);
      break;
    }

    case 'causality_gears': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.5), m.sandstone);
      base.position.y = 0.15;
      add(base);

      const gear1 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 8), m.marble);
      gear1.rotation.x = Math.PI / 2;
      gear1.position.set(-0.48, 1.05, 0);
      add(gear1);

      const gear2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.22, 8), m.gold);
      gear2.rotation.x = Math.PI / 2;
      gear2.position.set(0.48, 1.05, 0);
      add(gear2);

      const topCrown = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.62, 6), m.accent);
      topCrown.position.y = 1.75;
      add(topCrown);
      break;
    }

    case 'fruit_garden': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.3, 12), m.sandstone);
      base.position.y = 0.15;
      add(base);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.95, 8), m.darkBronze);
      trunk.position.y = 0.75;
      add(trunk);

      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), m.accent);
      crown.position.y = 1.48;
      add(crown);

      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), m.gold);
      fruit.position.set(0.42, 1.4, 0.42);
      add(fruit);
      break;
    }
  }

  return parts;
}

export function buildStationRig(
  station: Station,
  chapter: Chapter,
  textures: IslandTerrainTextures
): StationVisualRig {
  const root = new THREE.Group();
  root.name = `station_${station.id}`;

  const [ox, oz] = station.offsetOnIsland;
  const surfaceY = islandSurfaceHeight(ox, oz, chapter.islandRadius);
  root.position.set(
    chapter.islandPos[0] + ox,
    chapter.islandPos[1] + Math.max(0.85, surfaceY),
    chapter.islandPos[2] + oz
  );

  const parts = buildLandmarkGeometryParts(
    station.landmarkKind,
    chapter.accentHex,
    textures.goldMap
  );
  parts.forEach((p) => root.add(p));

  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8922b,
    emissive: 0xc8922b,
    emissiveIntensity: 0.25,
    roughness: 0.3,
    metalness: 0.65,
  });

  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.065, 8, 32),
    beaconMaterial
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = 0.08;
  root.add(beaconRing);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x1e6b47,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const haloMesh = new THREE.Mesh(
    new THREE.RingGeometry(1.45, 1.75, 32),
    haloMaterial
  );
  haloMesh.rotation.x = -Math.PI / 2;
  haloMesh.position.y = 0.06;
  root.add(haloMesh);

  // Invisible generous raycast target on layer 1
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const hitTarget = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.65, 2.7, 12),
    hitMat
  );
  hitTarget.position.y = 1.25;
  hitTarget.layers.set(1);
  hitTarget.userData = { stationId: station.id, chapterId: chapter.id };
  root.add(hitTarget);

  return {
    root,
    hitTarget,
    beaconRing,
    haloMesh,
    parts,
    beaconMaterial,
    haloMaterial,
  };
}

export function buildArchipelagoFoliage(chapters: Chapter[]): THREE.Group {
  const foliageGroup = new THREE.Group();
  foliageGroup.name = 'archipelago_foliage';

  const treePositions: { x: number; y: number; z: number; scale: number }[] = [];
  const rockPositions: { x: number; y: number; z: number; scale: number; rot: number }[] = [];

  chapters.forEach((ch, chIdx) => {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + chIdx * 0.4;
      const dist = ch.islandRadius * 0.78 + ((i % 3) - 1) * 0.55;
      const lx = Math.cos(ang) * dist;
      const lz = Math.sin(ang) * dist;

      // Skip if too close to any station
      const nearStation = ch.stations.some(
        (s) => Math.hypot(s.offsetOnIsland[0] - lx, s.offsetOnIsland[1] - lz) < 2.6
      );
      if (nearStation) continue;

      const sy = islandSurfaceHeight(lx, lz, ch.islandRadius);
      if (i % 3 === 0) {
        rockPositions.push({
          x: ch.islandPos[0] + lx,
          y: ch.islandPos[1] + sy + 0.12,
          z: ch.islandPos[2] + lz,
          scale: 0.45 + (i % 2) * 0.2,
          rot: ang,
        });
      } else {
        treePositions.push({
          x: ch.islandPos[0] + lx,
          y: ch.islandPos[1] + sy,
          z: ch.islandPos[2] + lz,
          scale: 0.85 + (i % 3) * 0.22,
        });
      }
    }
  });

  if (treePositions.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.9, 6);
    trunkGeo.translate(0, 0.45, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e543c, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    trunkInst.castShadow = true;

    const canopyGeo = new THREE.ConeGeometry(0.62, 1.85, 7);
    canopyGeo.translate(0, 1.55, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3b7a57, roughness: 0.78 });
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
    canopyInst.castShadow = true;
    canopyInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    treePositions.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, idx * 0.9, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);
      canopyInst.setMatrixAt(idx, dummy.matrix);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    foliageGroup.add(trunkInst, canopyInst);
  }

  if (rockPositions.length > 0) {
    const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xb7ab97, roughness: 0.92 });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    rockPositions.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0.2, p.rot, 0.1);
      dummy.scale.set(p.scale * 1.2, p.scale * 0.75, p.scale);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx, dummy.matrix);
    });
    rockInst.instanceMatrix.needsUpdate = true;
    rockInst.computeBoundingSphere();
    foliageGroup.add(rockInst);
  }

  return foliageGroup;
}

export interface BridgeVisualRig {
  chapterId: ChapterId;
  group: THREE.Group;
  deckMat: THREE.MeshStandardMaterial;
  railMat: THREE.MeshStandardMaterial;
}

export function buildWalkableBridge(
  bridge: BridgeSpan,
  textures: IslandTerrainTextures
): BridgeVisualRig {
  const group = new THREE.Group();
  group.name = `bridge_${bridge.chapterId}`;

  const len = bridge.endDist - bridge.startDist;
  const midDist = (bridge.startDist + bridge.endDist) * 0.5;
  const cx = HUB_CENTER.x + bridge.dirX * midDist;
  const cz = HUB_CENTER.z + bridge.dirZ * midDist;

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xebe3d3,
    map: textures.tileMap,
    roughness: 0.72,
    metalness: 0.08,
    emissive: new THREE.Color(0xc8922b),
    emissiveIntensity: 0.05,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xc8922b,
    emissive: new THREE.Color(0xc8922b),
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.65,
  });

  // Main wide walkable deck
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(bridge.halfWidth * 2, 0.26, len),
    deckMat
  );
  deck.position.y = bridge.surfaceY - 0.13;
  deck.receiveShadow = true;
  deck.castShadow = true;
  group.add(deck);

  // Subtle sculpted under-keel
  const keel = new THREE.Mesh(
    new THREE.BoxGeometry(bridge.halfWidth * 1.4, 0.28, len * 0.96),
    new THREE.MeshStandardMaterial({ color: 0xa49680, roughness: 0.85 })
  );
  keel.position.y = bridge.surfaceY - 0.36;
  group.add(keel);

  // Glowing side curbstones
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, len),
      railMat
    );
    rail.position.set(side * (bridge.halfWidth - 0.08), bridge.surfaceY + 0.06, 0);
    rail.castShadow = true;
    group.add(rail);
  }

  // Lantern stone bollards along bridge
  const postCount = Math.max(2, Math.floor(len / 5.5));
  for (let i = 0; i <= postCount; i++) {
    const zOff = -len * 0.45 + (i / postCount) * (len * 0.9);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 0.45, 6),
        railMat
      );
      post.position.set(side * (bridge.halfWidth - 0.12), bridge.surfaceY + 0.22, zOff);
      group.add(post);
    }
  }

  group.position.set(cx, 0, cz);
  group.rotation.y = bridge.angle;

  return { chapterId: bridge.chapterId, group, deckMat, railMat };
}

export interface StudentAvatarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  shadowDisc: THREE.Mesh;
  boyGroup: THREE.Group;
  girlGroup: THREE.Group;
  robeMat: THREE.MeshStandardMaterial;
  satchelMat: THREE.MeshStandardMaterial;
}

export function resolveCosmeticHex(
  options: { id: string; hex: string }[],
  id: string,
  fallbackHex: string
): string {
  return options.find((o) => o.id === id)?.hex ?? fallbackHex;
}

export function buildStudentAvatarRig(config: AvatarConfig): StudentAvatarRig {
  const root = new THREE.Group();
  root.name = 'player_student_avatar';

  const robeHex = resolveCosmeticHex(ROBE_COLOR_OPTIONS, config.robeColorId, '#F3EFE4');
  const satchelHex = resolveCosmeticHex(SATCHEL_COLOR_OPTIONS, config.satchelColorId, '#6E472B');

  const robeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(robeHex),
    roughness: 0.72,
    metalness: 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xc8922b,
    roughness: 0.35,
    metalness: 0.6,
  });
  const satchelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(satchelHex),
    roughness: 0.62,
    metalness: 0.1,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe8c7a3,
    roughness: 0.68,
    metalness: 0.02,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x3b3026,
    roughness: 0.85,
  });
  const hijabMat = new THREE.MeshStandardMaterial({
    color: 0xf9f6ee,
    roughness: 0.75,
  });

  // Ground drop shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({
      color: 0x171c19,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.025;
  root.add(shadowDisc);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Legs (modestly tucked under robe hem)
  const makeLeg = (offsetX: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(offsetX, 0.42, 0);
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.36, 8), robeMat);
    legMesh.position.y = -0.18;
    legMesh.castShadow = true;
    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), shoeMat);
    footMesh.position.set(0, -0.37, 0.04);
    footMesh.castShadow = true;
    pivot.add(legMesh, footMesh);
    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLegPivot = makeLeg(-0.14);
  const rightLegPivot = makeLeg(0.14);

  // Modest full-length robe torso
  const torsoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 0.88, 12),
    robeMat
  );
  torsoMesh.position.y = 0.78;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Decorative collar / waist trim
  const waistTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.255, 0.024, 6, 18),
    trimMat
  );
  waistTrim.rotation.x = Math.PI / 2;
  waistTrim.position.y = 0.92;
  bodyPivot.add(waistTrim);

  // Booklet Satchel / Bag on back
  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.16), satchelMat);
  satchel.position.set(0, 0.9, -0.27);
  satchel.castShadow = true;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), trimMat);
  buckle.position.set(0, 0.92, -0.35);
  bodyPivot.add(satchel, buckle);

  // Arms
  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, 1.14, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.44, 8), robeMat);
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), skinMat);
    hand.position.y = -0.44;
    pivot.add(sleeve, hand);
    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArmPivot = makeArm(-1);
  const rightArmPivot = makeArm(1);

  // Head pivot + gender-specific modest headwear
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.38, 0);
  bodyPivot.add(headPivot);

  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), skinMat);
  headSphere.castShadow = true;
  headPivot.add(headSphere);

  // Subtle scholarly eyes (forward +Z direction)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x171c19 });
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat);
    eye.position.set(ex, 0.02, 0.19);
    headPivot.add(eye);
  }

  // Boy group: neat hair + crisp scholarly taqiyah cap
  const boyGroup = new THREE.Group();
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x2b231d, roughness: 0.9 })
  );
  hairCap.rotation.x = -0.22;
  const taqiyah = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.19, 0.11, 14),
    new THREE.MeshStandardMaterial({ color: 0xfbf9f4, roughness: 0.7 })
  );
  taqiyah.position.y = 0.17;
  const taqiyahBand = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.015, 6, 16), trimMat);
  taqiyahBand.rotation.x = Math.PI / 2;
  taqiyahBand.position.y = 0.125;
  boyGroup.add(hairCap, taqiyah, taqiyahBand);
  headPivot.add(boyGroup);

  // Girl group: modest enveloping hijab & khimar drape covering head, neck & shoulders
  const girlGroup = new THREE.Group();
  const hijabHood = new THREE.Mesh(
    new THREE.SphereGeometry(0.235, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.85),
    hijabMat
  );
  hijabHood.rotation.x = -0.18;
  const khimarDrape = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.48, 14),
    hijabMat
  );
  khimarDrape.position.set(0, -0.16, -0.04);
  const headbandTrim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.016, 6, 18), trimMat);
  headbandTrim.rotation.x = Math.PI * 0.42;
  headbandTrim.position.set(0, 0.06, 0.03);
  girlGroup.add(hijabHood, khimarDrape, headbandTrim);
  headPivot.add(girlGroup);

  boyGroup.visible = config.gender === 'boy';
  girlGroup.visible = config.gender === 'girl';

  return {
    root,
    bodyPivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    shadowDisc,
    boyGroup,
    girlGroup,
    robeMat,
    satchelMat,
  };
}
