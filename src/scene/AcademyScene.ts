import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Chapter, CHAPTERS, ChapterId, getStationById } from '../curriculum';
import { StationProgressState } from '../firebase/progressService';
import { CameraRig } from '../game/CameraRig';
import { InputManager } from '../game/InputManager';
import { InteractionSystem, REVIEW_PORTAL_POS } from '../game/InteractionSystem';
import { PlayerController } from '../game/PlayerController';
import { QuestSystem } from '../game/QuestSystem';
import {
  AvatarConfig,
  CameraMode,
  InteractableTarget,
  MinimapMarker,
  PlayerPositionState,
  QualityPreset,
  QuestGuidanceState,
} from '../game/types';
import {
  ARCHIPELAGO_BRIDGES,
  BridgeVisualRig,
  buildArchipelagoFoliage,
  buildIslandGroup,
  buildStationRig,
  buildWalkableBridge,
  createProceduralTextures,
  getWalkableSurfaceAt,
  HUB_CENTER,
  StationVisualRig,
} from './ProceduralAssets';

export interface SceneHudSnapshot {
  playerPos: PlayerPositionState;
  cameraMode: CameraMode;
  guidance: QuestGuidanceState;
  markers: MinimapMarker[];
  isMoving: boolean;
  isTouchDevice: boolean;
  remainingStarsToday: number;
}

export interface SceneCallbacks {
  onSelectStation: (stationId: string) => void;
  onOpenReviewPortal: () => void;
  onHoverStation: (stationId: string | null, screenX: number, screenY: number) => void;
  onNearestInteractableChange: (target: InteractableTarget | null) => void;
  onHudTick: (snapshot: SceneHudSnapshot) => void;
  onCollectStar: (starId: string) => void;
  onTogglePause?: () => void;
  onLoadProgress?: (percent: number, label: string) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export interface SceneInitialOptions {
  avatar: AvatarConfig;
  initialPos?: PlayerPositionState;
  collectedStarIdsToday?: string[];
  quality?: QualityPreset;
  sensitivity?: number;
  reducedMotion?: boolean;
}

interface PulseGlowEffect {
  groundMesh: THREE.Mesh;
  groundShader: THREE.ShaderMaterial;
  auraMesh: THREE.Mesh;
  auraShader: THREE.ShaderMaterial;
  particlesPoints: THREE.Points;
  particlesShader: THREE.ShaderMaterial;
  isPassed: boolean;
  isThreeStars: boolean;
  phaseOffset: number;
}

function createGroundPulseShaderMaterial(phaseOffset: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x3ad185) },
      uPhase: { value: phaseOffset },
      uIntensity: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uPhase;
      uniform float uIntensity;
      varying vec2 vUv;

      void main() {
        float dist = length(vUv - vec2(0.5)) * 2.0;
        float edgeMask = smoothstep(1.0, 0.70, dist);
        float coreGlow = exp(-dist * dist * 3.4);
        float breath = 0.5 + 0.5 * sin(uTime * 2.3 + uPhase);

        float waveT = fract(uTime * 0.42 + uPhase * 0.17);
        float ringRadius = 0.28 + waveT * 0.64;
        float ring = smoothstep(0.13, 0.0, abs(dist - ringRadius)) * (1.0 - waveT);

        float alpha = (coreGlow * (0.34 + 0.24 * breath) + ring * 0.55) * edgeMask * uIntensity;
        vec3 finalCol = uColor * (1.15 + 0.35 * breath);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function createMonumentAuraShaderMaterial(phaseOffset: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x3ad185) },
      uPhase: { value: phaseOffset },
      uIntensity: { value: 1.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        float swell = sin(uTime * 2.3 + uPhase) * 0.035;
        vec3 displaced = position + vec3(normal.x, 0.0, normal.z) * swell;
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vNormalDir = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uPhase;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;

      void main() {
        float vertFade = smoothstep(0.0, 0.20, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalDir), normalize(vViewDir))), 1.35);
        float scanBand = 0.5 + 0.5 * sin(vUv.y * 8.5 - uTime * 2.8 + uPhase);
        float pulse = 0.65 + 0.35 * sin(uTime * 2.3 + uPhase);

        float alpha = vertFade * (0.12 + 0.28 * fresnel + 0.14 * scanBand) * pulse * uIntensity;
        vec3 finalCol = uColor * (1.10 + 0.32 * scanBand);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function createKnowledgeParticlesGeometry(count = 26): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const h1 = Math.abs(Math.sin(i * 12.9898 + 1.23) * 43758.5453) % 1;
    const h2 = Math.abs(Math.sin(i * 78.233 + 4.56) * 24634.6345) % 1;
    const h3 = Math.abs(Math.sin(i * 39.425 + 7.89) * 19341.1234) % 1;

    const angle = (i / count) * Math.PI * 2 + h1 * 0.4;
    const radius = 0.85 + h2 * 0.82;
    const baseY = 0.3 + h3 * 2.6;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = baseY;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    seeds[i * 3] = 0.14 + h1 * 0.14;
    seeds[i * 3 + 1] = 0.75 + h2 * 0.75;
    seeds[i * 3 + 2] = (i / count + h3 * 0.25) % 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.computeBoundingSphere();
  return geo;
}

function createKnowledgeParticlesShaderMaterial(
  phaseOffset: number,
  pixelRatio: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x3ad185) },
      uPhase: { value: phaseOffset },
      uIntensity: { value: 0.95 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uPixelRatio;
      attribute vec3 aSeed;
      varying float vAlpha;
      varying float vSparkle;

      void main() {
        float life = fract(uTime * aSeed.x + aSeed.z + uPhase * 0.13);
        float baseAngle = atan(position.z, position.x);
        float swirlAngle = baseAngle + life * 1.9 + uTime * 0.24;
        float radius = length(position.xz) + sin(life * 6.28318 + uPhase) * 0.14;

        vec3 pos;
        pos.x = cos(swirlAngle) * radius;
        pos.z = sin(swirlAngle) * radius;
        pos.y = 0.24 + life * 2.95;

        vAlpha = smoothstep(0.0, 0.18, life) * smoothstep(1.0, 0.35, life);
        vSparkle = 0.70 + 0.30 * sin(uTime * 4.2 + aSeed.z * 24.0 + uPhase);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp((aSeed.y * uPixelRatio * 28.0) / max(-mvPosition.z, 1.0), 2.0, 18.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying float vAlpha;
      varying float vSparkle;

      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r2 = dot(cxy, cxy);
        if (r2 > 1.0) discard;

        float core = exp(-r2 * 4.4);
        float halo = smoothstep(1.0, 0.0, sqrt(r2)) * 0.42;
        float alpha = (core + halo) * vAlpha * vSparkle * uIntensity;
        vec3 finalCol = mix(uColor, vec3(1.0, 0.98, 0.88), core * 0.48);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class AcademyScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private sunLight: THREE.DirectionalLight;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;
  private raycaster: THREE.Raycaster;
  private pointer = new THREE.Vector2();

  private stationRigs = new Map<string, StationVisualRig>();
  private pulseGlows = new Map<string, PulseGlowEffect>();
  private islandGroups = new Map<string, THREE.Group>();
  private bridgeRigs: BridgeVisualRig[] = [];
  private callbacks: SceneCallbacks;

  readonly input: InputManager;
  private player: PlayerController;
  private cameraRig: CameraRig;
  private interaction = new InteractionSystem();
  private quests: QuestSystem;

  private isDisposed = false;
  private isSoftwareGl = false;
  private isTabHidden = false;
  private rafId: number | null = null;
  private timerId: number | null = null;
  private clock = new THREE.Clock();

  // Dynamic visual feedback state
  private activeStationId: string | null = null;
  private activePartIndex = 0;
  private hoveredStationId: string | null = null;
  private pointerDownPos = { x: 0, y: 0 };
  private lastStationStates: Record<string, StationProgressState> = {};
  private dueReviewCount = 0;
  private lastHudPushTime = 0;
  private prevMovingState = false;

  // Adaptive quality tracking
  private qualityPreset: QualityPreset = 'auto';
  private autoTier: 'low' | 'medium' | 'high' = 'high';
  private fpsSamples: number[] = [];
  private fpsTimer = 0;

  // Pre-allocated colors
  private readonly colUnexplored = new THREE.Color(0x8e887e);
  private readonly colInProgress = new THREE.Color(0xc8922b);
  private readonly colMastered = new THREE.Color(0x1e6b47);
  private readonly colMasteredGlow = new THREE.Color(0x3ad185);
  private readonly colThreeStarGlow = new THREE.Color(0xe5b84b);
  private readonly colHighlight = new THREE.Color(0x38bdf8);

  constructor(
    container: HTMLElement,
    callbacks: SceneCallbacks,
    options: SceneInitialOptions
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.qualityPreset = options.quality ?? 'auto';

    callbacks.onLoadProgress?.(12, 'تهيئة محرك العرض ثلاثي الأبعاد...');

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const rendererName = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      this.isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererName);
      if (this.isSoftwareGl) {
        this.autoTier = 'low';
      }
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeef2f6);
    this.scene.fog = new THREE.FogExp2(0xeef2f6, 0.0052);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 320);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minPolarAngle = 0.22;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 125;

    callbacks.onLoadProgress?.(34, 'إعداد الإضاءة والمناخ النهاري...');

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.55;

    const hemi = new THREE.HemisphereLight(0xd9ecff, 0x9c8b75, 0.95);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1d4, 2.25);
    this.sunLight.position.set(42, 64, 28);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 180;
    const d = 62;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0xcfe4f8, 0.6);
    rimLight.position.set(-45, 26, -38);
    this.scene.add(rimLight);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);

    // Initialize Player, CameraRig, InputManager, QuestSystem
    this.input = new InputManager(this.renderer.domElement, {
      onTogglePause: () => this.callbacks.onTogglePause?.(),
      onToggleMap: () => this.toggleTopDownMode(),
      onCycleCameraMode: () => this.cycleCameraMode(),
    });
    if (options.sensitivity !== undefined) {
      this.input.setSensitivity(options.sensitivity);
    }

    this.player = new PlayerController(options.avatar, options.initialPos);
    this.player.setReducedMotion(Boolean(options.reducedMotion));
    this.scene.add(this.player.rig.root);

    this.cameraRig = new CameraRig(this.camera, this.controls);
    this.cameraRig.setReducedMotion(Boolean(options.reducedMotion));
    this.controls.addEventListener('start', this.handleUserCameraStart);

    this.quests = new QuestSystem(options.avatar.companionColorId);
    this.quests.setReducedMotion(Boolean(options.reducedMotion));
    if (options.collectedStarIdsToday) {
      this.quests.syncCollectedStars(options.collectedStarIdsToday);
    }
    this.scene.add(this.quests.group);

    callbacks.onLoadProgress?.(58, 'تشييد الجزر الخمس والجسور المضيئة...');
    this.buildWorld();

    this.applyQualitySettings();
    this.attachEvents();

    callbacks.onLoadProgress?.(100, 'الأرخبيل جاهز للاستكشاف');
    this.pushHudSnapshot(true);
    this.scheduleNextTick();
  }

  private buildWorld() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);

    // Central Observatory Beacon linking all 5 islands visually
    const hubGroup = new THREE.Group();
    const hubBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.9, 1.1, 20),
      new THREE.MeshStandardMaterial({
        color: 0xe6dfd1,
        map: textures.tileMap,
        roughness: 0.72,
      })
    );
    hubBase.position.y = 0.2;
    hubBase.receiveShadow = true;
    hubBase.castShadow = true;
    hubGroup.add(hubBase);

    const hubMonument = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshStandardMaterial({
        map: textures.goldMap,
        roughness: 0.25,
        metalness: 0.85,
      })
    );
    hubMonument.scale.set(1, 1.75, 1);
    hubMonument.position.y = 3.1;
    hubMonument.castShadow = true;
    hubGroup.add(hubMonument);
    hubGroup.position.set(HUB_CENTER.x, 0, HUB_CENTER.z);
    this.scene.add(hubGroup);

    // Wide walkable bridges from Central Hub to all 5 Chapter Islands
    this.bridgeRigs = ARCHIPELAGO_BRIDGES.map((span) => {
      const rig = buildWalkableBridge(span, textures);
      this.scene.add(rig.group);
      return rig;
    });

    const sharedParticlesGeo = createKnowledgeParticlesGeometry(26);
    const pixelRatio = this.renderer.getPixelRatio();

    CHAPTERS.forEach((chapter: Chapter) => {
      const island = buildIslandGroup(chapter, textures);
      island.position.set(...chapter.islandPos);
      this.scene.add(island);
      this.islandGroups.set(chapter.id, island);

      chapter.stations.forEach((station) => {
        const rig = buildStationRig(station, chapter, textures);
        const phaseOffset = station.order * 1.15 + chapter.chapterNumber * 0.85;

        const groundShader = createGroundPulseShaderMaterial(phaseOffset);
        const groundMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(4.8, 4.8),
          groundShader
        );
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = 0.045;
        groundMesh.visible = false;
        rig.root.add(groundMesh);

        const auraShader = createMonumentAuraShaderMaterial(phaseOffset);
        const auraMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1.48, 1.62, 2.2, 28, 1, true),
          auraShader
        );
        auraMesh.position.y = 1.1;
        auraMesh.visible = false;
        rig.root.add(auraMesh);

        const particlesShader = createKnowledgeParticlesShaderMaterial(
          phaseOffset,
          pixelRatio
        );
        const particlesPoints = new THREE.Points(sharedParticlesGeo, particlesShader);
        particlesPoints.visible = false;
        rig.root.add(particlesPoints);

        this.scene.add(rig.root);
        this.stationRigs.set(station.id, rig);
        this.pulseGlows.set(station.id, {
          groundMesh,
          groundShader,
          auraMesh,
          auraShader,
          particlesPoints,
          particlesShader,
          isPassed: false,
          isThreeStars: false,
          phaseOffset,
        });
      });
    });

    const foliage = buildArchipelagoFoliage(CHAPTERS);
    this.scene.add(foliage);
  }

  private getEffectiveQuality(): 'low' | 'medium' | 'high' {
    return this.qualityPreset === 'auto' ? this.autoTier : this.qualityPreset;
  }

  private applyQualitySettings() {
    const tier = this.getEffectiveQuality();
    const rawDpr = window.devicePixelRatio || 1;
    const cap = tier === 'low' ? 1.0 : tier === 'medium' ? 1.25 : 1.5;
    this.renderer.setPixelRatio(Math.min(rawDpr, cap));
    this.renderer.shadowMap.enabled = tier !== 'low';
    this.sunLight.castShadow = tier !== 'low';
    if (tier === 'medium' && this.sunLight.shadow.mapSize.x !== 1024) {
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    } else if (tier === 'high' && this.sunLight.shadow.mapSize.x !== 2048) {
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    const pr = this.renderer.getPixelRatio();
    this.pulseGlows.forEach((g) => {
      g.particlesShader.uniforms.uPixelRatio.value = pr;
    });
  }

  setQualityPreset(preset: QualityPreset) {
    this.qualityPreset = preset;
    this.fpsSamples = [];
    this.fpsTimer = 0;
    this.applyQualitySettings();
  }

  setCameraSensitivity(value: number) {
    this.input.setSensitivity(value);
  }

  setReducedMotion(enabled: boolean) {
    this.player.setReducedMotion(enabled);
    this.cameraRig.setReducedMotion(enabled);
    this.quests.setReducedMotion(enabled);
  }

  setPaused(paused: boolean) {
    this.input.setPaused(paused);
  }

  updateAvatarAppearance(avatar: AvatarConfig) {
    this.player.updateAppearance(avatar);
    this.quests.setCompanionColor(avatar.companionColorId);
  }

  syncCollectedStars(collectedIds: string[]) {
    this.quests.syncCollectedStars(collectedIds);
  }

  setDueReviewCount(count: number) {
    this.dueReviewCount = count;
    this.quests.setReviewPortalActive(count > 0);
  }

  getCameraMode(): CameraMode {
    return this.cameraRig.getMode();
  }

  setCameraMode(mode: CameraMode) {
    this.cameraRig.setMode(mode, this.player.position);
    this.input.setCameraOrbitEnabled(mode === 'player');
    this.pushHudSnapshot(true);
  }

  cycleCameraMode() {
    const order: CameraMode[] = ['player', 'orbit', 'topdown'];
    const cur = this.cameraRig.getMode();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    this.setCameraMode(next);
  }

  toggleTopDownMode() {
    const cur = this.cameraRig.getMode();
    this.setCameraMode(cur === 'topdown' ? 'player' : 'topdown');
  }

  getPlayerPositionSnapshot(): PlayerPositionState {
    return this.player.getSnapshot();
  }

  resetPlayerToHub() {
    this.player.teleportTo(0, 4.1, Math.PI);
    this.setCameraMode('player');
    this.pushHudSnapshot(true);
  }

  walkToWorldPoint(x: number, z: number, stopRadius = 2.6, onArrive?: () => void) {
    // If target is on a different island across void, bring player smoothly onto the target island rim first if needed
    const curSurf = getWalkableSurfaceAt(this.player.position.x, this.player.position.z);
    const dstSurf = getWalkableSurfaceAt(x, z);
    if (
      curSurf.chapterId &&
      dstSurf.chapterId &&
      curSurf.chapterId !== dstSurf.chapterId &&
      Math.hypot(x - this.player.position.x, z - this.player.position.z) > 22
    ) {
      const ch = CHAPTERS.find((c) => c.id === dstSurf.chapterId);
      if (ch) {
        // Place at the bridge landing on that island so player walks naturally onto the station
        const bridge = ARCHIPELAGO_BRIDGES.find((b) => b.chapterId === ch.id);
        if (bridge) {
          const lx = HUB_CENTER.x + bridge.dirX * (bridge.endDist - 0.5);
          const lz = HUB_CENTER.z + bridge.dirZ * (bridge.endDist - 0.5);
          this.player.teleportTo(lx, lz);
        }
      }
    }
    this.player.walkTo(x, z, stopRadius, onArrive);
  }

  walkToStationAndOpen(stationId: string) {
    const st = getStationById(stationId);
    const rig = this.stationRigs.get(stationId);
    if (!st || !rig) return;
    const p = rig.root.position;
    const dist = Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z);
    if (dist <= 3.7) {
      this.callbacks.onSelectStation(stationId);
      return;
    }
    this.walkToWorldPoint(p.x, p.z, 2.75, () => {
      this.callbacks.onSelectStation(stationId);
    });
  }

  walkToReviewPortal() {
    this.walkToWorldPoint(REVIEW_PORTAL_POS.x, REVIEW_PORTAL_POS.z, 2.2, () => {
      this.callbacks.onOpenReviewPortal();
    });
  }

  activateNearestInteractable() {
    const target = this.interaction.getNearest();
    if (!target) return;
    if (target.kind === 'review_portal') {
      this.callbacks.onOpenReviewPortal();
    } else {
      this.callbacks.onSelectStation(target.id);
    }
  }

  celebrateStationMastery(stationId: string) {
    const rig = this.stationRigs.get(stationId);
    if (!rig) return;
    this.quests.triggerMasteryBurst(rig.root.position.x, rig.root.position.y, rig.root.position.z);
    this.cameraRig.triggerShake(0.18, 0.35);
  }

  private handleUserCameraStart = () => {
    this.cameraRig.cancelOrbitFlight();
  };

  private handleResize = () => {
    if (this.isDisposed) return;
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleVisibilityChange = () => {
    this.isTabHidden = document.hidden;
    if (!this.isTabHidden) {
      this.clock.getDelta(); // reset dt spike on resume
    }
  };

  private updatePointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickStation(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      const sid = h.object.userData?.stationId as string | undefined;
      if (sid) return sid;
    }
    return null;
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (this.isDisposed) return;
    this.updatePointer(e);
    const sid = this.pickStation();
    if (sid !== this.hoveredStationId) {
      this.hoveredStationId = sid;
      this.renderer.domElement.style.cursor = sid ? 'pointer' : 'grab';
    }
    this.callbacks.onHoverStation(sid, e.clientX, e.clientY);
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dist = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y
    );
    if (dist > 6) return;
    this.updatePointer(e);
    const sid = this.pickStation();
    if (sid) {
      if (this.cameraRig.getMode() === 'player') {
        this.walkToStationAndOpen(sid);
      } else {
        this.callbacks.onSelectStation(sid);
      }
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost?.();
  };

  private handleContextRestored = () => {
    this.callbacks.onContextRestored?.();
  };

  private attachEvents() {
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  flyToOverview() {
    if (this.cameraRig.getMode() === 'orbit') {
      this.cameraRig.flyOrbitTo(new THREE.Vector3(0, 42, 68), new THREE.Vector3(0, 2, 6));
    } else {
      this.setCameraMode('topdown');
    }
  }

  flyToChapter(chapterId: ChapterId) {
    const ch = CHAPTERS.find((c) => c.id === chapterId);
    if (!ch) return;
    const [ix, iy, iz] = ch.islandPos;
    if (this.cameraRig.getMode() === 'orbit') {
      this.cameraRig.flyOrbitTo(
        new THREE.Vector3(ix, iy + 16, iz + 24),
        new THREE.Vector3(ix, iy + 1.5, iz)
      );
    } else {
      // Walk / move cleanly onto chapter plaza in player mode
      this.player.teleportTo(ix, iz + 3.2);
      this.pushHudSnapshot(true);
    }
  }

  flyToStation(stationId: string) {
    const rig = this.stationRigs.get(stationId);
    if (!rig) return;
    const p = rig.root.position;
    if (this.cameraRig.getMode() === 'orbit') {
      this.cameraRig.flyOrbitTo(
        new THREE.Vector3(p.x + 5.2, p.y + 6.4, p.z + 8.6),
        new THREE.Vector3(p.x, p.y + 1.1, p.z)
      );
    } else {
      this.cameraRig.focusStationTemporarily(p);
    }
  }

  returnCameraToPlayer() {
    this.cameraRig.clearStationFocus();
  }

  setActiveStationHighlight(stationId: string | null, partIndex = 0) {
    const prevId = this.activeStationId;
    this.activeStationId = stationId;
    this.activePartIndex = partIndex;
    if (!stationId) {
      this.cameraRig.clearStationFocus();
    }
    if (prevId && prevId !== stationId) {
      this.syncProgressVisuals(this.lastStationStates);
    }
  }

  syncProgressVisuals(stationStates: Record<string, StationProgressState>) {
    this.lastStationStates = stationStates;
    this.stationRigs.forEach((rig, stationId) => {
      const st = stationStates[stationId];
      const glow = this.pulseGlows.get(stationId);

      if (!st || (st.completedCardIds.length === 0 && !st.challengePassed)) {
        rig.beaconMaterial.color.copy(this.colUnexplored);
        rig.beaconMaterial.emissive.copy(this.colUnexplored);
        rig.beaconMaterial.emissiveIntensity = 0.08;
        rig.haloMaterial.opacity = 0;
        if (glow) {
          glow.isPassed = false;
          glow.isThreeStars = false;
          glow.groundMesh.visible = false;
          glow.auraMesh.visible = false;
          glow.particlesPoints.visible = false;
        }
      } else if (st.challengePassed) {
        const isThree = st.stars >= 3;
        const targetGlowColor = isThree ? this.colThreeStarGlow : this.colMasteredGlow;
        rig.beaconMaterial.color.copy(this.colMastered);
        rig.beaconMaterial.emissive.copy(targetGlowColor);
        rig.beaconMaterial.emissiveIntensity = 0.58;
        rig.haloMaterial.color.copy(isThree ? this.colThreeStarGlow : this.colMastered);
        rig.haloMaterial.opacity = 0.42;
        if (glow) {
          glow.isPassed = true;
          glow.isThreeStars = isThree;
          glow.groundShader.uniforms.uColor.value.copy(targetGlowColor);
          glow.auraShader.uniforms.uColor.value.copy(targetGlowColor);
          glow.particlesShader.uniforms.uColor.value.copy(targetGlowColor);
          glow.groundShader.uniforms.uIntensity.value = isThree ? 1.15 : 0.95;
          glow.auraShader.uniforms.uIntensity.value = isThree ? 1.15 : 0.95;
          glow.particlesShader.uniforms.uIntensity.value = isThree ? 1.05 : 0.85;
          glow.groundMesh.visible = true;
          glow.auraMesh.visible = true;
          glow.particlesPoints.visible = true;
        }
      } else {
        rig.beaconMaterial.color.copy(this.colInProgress);
        rig.beaconMaterial.emissive.copy(this.colInProgress);
        rig.beaconMaterial.emissiveIntensity = 0.35;
        rig.haloMaterial.color.copy(this.colInProgress);
        rig.haloMaterial.opacity = 0.25;
        if (glow) {
          glow.isPassed = false;
          glow.isThreeStars = false;
          glow.groundMesh.visible = false;
          glow.auraMesh.visible = false;
          glow.particlesPoints.visible = false;
        }
      }
    });
    this.pushHudSnapshot(true);
  }

  private pushHudSnapshot(force = false) {
    const now = performance.now();
    const isMoving = this.player.isCurrentlyMoving();
    if (!force && isMoving === this.prevMovingState && now - this.lastHudPushTime < 140) {
      return;
    }
    this.prevMovingState = isMoving;
    this.lastHudPushTime = now;

    const guidance = this.quests.computeGuidance(
      this.player.position,
      this.cameraRig.getYaw(),
      this.lastStationStates,
      this.dueReviewCount
    );
    const markers = this.quests.getMinimapMarkers(this.lastStationStates);

    this.callbacks.onHudTick({
      playerPos: this.player.getSnapshot(),
      cameraMode: this.cameraRig.getMode(),
      guidance,
      markers,
      isMoving,
      isTouchDevice: this.input.isTouchDevice(),
      remainingStarsToday: this.quests.getRemainingStarsCount(),
    });
  }

  private scheduleNextTick() {
    if (this.isDisposed) return;
    if (this.isSoftwareGl) {
      this.timerId = window.setTimeout(() => this.tick(), 35);
    } else {
      this.rafId = window.requestAnimationFrame(() => this.tick());
    }
  }

  private tick() {
    if (this.isDisposed) return;
    if (this.isTabHidden) {
      this.scheduleNextTick();
      return;
    }

    const dt = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.elapsedTime;

    // Auto quality monitor (steps down if real hardware drops below 42 fps)
    if (this.qualityPreset === 'auto' && !this.isSoftwareGl && dt > 0) {
      this.fpsSamples.push(1 / dt);
      this.fpsTimer += dt;
      if (this.fpsTimer >= 3.0 && this.fpsSamples.length > 20) {
        const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
        this.fpsSamples = [];
        this.fpsTimer = 0;
        if (avg < 42 && this.autoTier !== 'low') {
          this.autoTier = this.autoTier === 'high' ? 'medium' : 'low';
          this.applyQualitySettings();
        }
      }
    }

    // 1. Sample unified InputManager & update Player & CameraRig
    const frameInput = this.input.sampleFrame(dt);
    this.player.update(dt, elapsed, frameInput, this.cameraRig.getYaw());
    this.cameraRig.update(dt, this.player.position, frameInput);

    // 2. Proximity interaction + keyboard/gamepad E trigger
    this.interaction.update(
      this.player.position,
      this.dueReviewCount > 0,
      this.callbacks.onNearestInteractableChange
    );
    if (frameInput.interactPressed) {
      this.activateNearestInteractable();
    }

    // 3. Quests: Knowledge Stars, Faceless Companion Orb, Review Portal, Burst
    this.quests.update(
      dt,
      elapsed,
      this.player.position,
      this.player.yaw,
      (starId) => {
        this.callbacks.onCollectStar(starId);
      }
    );

    // Highlight recommended bridge path warmly
    const recGuidance = this.quests.computeGuidance(
      this.player.position,
      this.cameraRig.getYaw(),
      this.lastStationStates,
      this.dueReviewCount
    );
    const bridgePulse = 0.45 + 0.35 * Math.sin(elapsed * 2.6);
    for (const br of this.bridgeRigs) {
      const isRec = br.chapterId === recGuidance.recommendedBridgeChapterId;
      br.railMat.emissiveIntensity = isRec ? 0.55 + bridgePulse * 0.45 : 0.16;
      br.deckMat.emissiveIntensity = isRec ? 0.14 + bridgePulse * 0.1 : 0.03;
    }

    // 4. Passed stations shaders + proximity station halo highlight
    const nearest = this.interaction.getNearest();
    this.stationRigs.forEach((rig, sid) => {
      const isHovered = sid === this.hoveredStationId;
      const isActive = sid === this.activeStationId;
      const isNear = nearest?.kind === 'station' && nearest.id === sid;
      const targetScale = isActive ? 1.12 : isNear ? 1.09 : isHovered ? 1.06 : 1.0;
      rig.root.scale.x = THREE.MathUtils.damp(rig.root.scale.x, targetScale, 8, dt);
      rig.root.scale.y = THREE.MathUtils.damp(rig.root.scale.y, targetScale, 8, dt);
      rig.root.scale.z = THREE.MathUtils.damp(rig.root.scale.z, targetScale, 8, dt);

      const glow = this.pulseGlows.get(sid);
      if (glow?.isPassed) {
        glow.groundShader.uniforms.uTime.value = elapsed;
        glow.auraShader.uniforms.uTime.value = elapsed;
        glow.particlesShader.uniforms.uTime.value = elapsed;

        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.3 + glow.phaseOffset);
        rig.beaconMaterial.emissiveIntensity = 0.42 + pulse * 0.44;

        if (!isActive) {
          rig.haloMaterial.color.copy(
            glow.isThreeStars ? this.colThreeStarGlow : this.colMastered
          );
          rig.haloMaterial.opacity = 0.3 + pulse * 0.22;
          const haloScale = 1.0 + pulse * 0.06;
          rig.haloMesh.scale.set(haloScale, haloScale, 1);
        }
      } else if (isNear && !isActive) {
        rig.haloMaterial.color.copy(this.colHighlight);
        rig.haloMaterial.opacity = 0.35 + Math.sin(elapsed * 3.5) * 0.12;
      }

      if (isActive && rig.parts.length > 0) {
        const idx = this.activePartIndex % rig.parts.length;
        rig.parts.forEach((part, pIdx) => {
          const s = pIdx === idx ? 1.0 + Math.sin(elapsed * 4) * 0.045 : 1.0;
          part.scale.setScalar(s);
        });
        rig.haloMaterial.color.copy(this.colHighlight);
        rig.haloMaterial.opacity = 0.45 + Math.sin(elapsed * 3.5) * 0.15;
        rig.haloMesh.scale.set(1, 1, 1);
      } else {
        rig.parts.forEach((part) => {
          if (part.scale.x !== 1) part.scale.setScalar(1);
        });
      }
    });

    this.pushHudSnapshot(false);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  dispose() {
    this.isDisposed = true;
    if (this.rafId !== null) window.cancelAnimationFrame(this.rafId);
    if (this.timerId !== null) window.clearTimeout(this.timerId);

    this.input.dispose();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.controls.removeEventListener('start', this.handleUserCameraStart);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        const renderable = obj as THREE.Mesh | THREE.Points;
        renderable.geometry?.dispose();
        const mats = Array.isArray(renderable.material)
          ? renderable.material
          : [renderable.material];
        mats.forEach((mat) => {
          if (!mat) return;
          for (const val of Object.values(mat)) {
            if (val && typeof val === 'object' && 'isTexture' in val) {
              (val as THREE.Texture).dispose();
            }
          }
          mat.dispose();
        });
      }
    });

    this.envRT.dispose();
    this.pmremGenerator.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
