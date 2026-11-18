import * as THREE from 'three';
import { CHAPTERS, ChapterId } from '../curriculum';
import { StationProgressState } from '../firebase/progressService';
import {
  getWalkableSurfaceAt,
  HUB_CENTER,
  islandSurfaceHeight,
  pushOutOfObstacles,
  resolveCosmeticHex,
} from '../scene/ProceduralAssets';
import { REVIEW_PORTAL_POS } from './InteractionSystem';
import { COMPANION_COLOR_OPTIONS, MinimapMarker, QuestGuidanceState } from './types';

export interface KnowledgeStarPoint {
  id: string;
  chapterId: ChapterId;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

const CHAPTER_SHORT_HINTS: Record<ChapterId, string> = {
  ch2: 'في جزيرة الملائكة: تذكّر الضابط في أسماء الملائكة وما يثبت منها وما يُتوقّف فيه.',
  ch3: 'في جزيرة الرسل: فرّق بين الطريق الصاعد للعبادة والطريق النازل لتبليغ الوحي.',
  ch4: 'في جزيرة الكتب: راجع ترتيب الكتب الستة وحفظ القرآن في الصدور والسطور.',
  ch5: 'في جزيرة اليوم الآخر: تأمّل أحداث القيامة الستة وأشراط الساعة الصغرى والكبرى.',
  ch6: 'في جزيرة القضاء والقدر: اضبط المراتب الأربع والفرق بين الإرادة الكونية والشرعية.',
};

export class QuestSystem {
  readonly group = new THREE.Group();

  // Instanced Knowledge Stars
  private stars: KnowledgeStarPoint[] = [];
  private starMesh: THREE.InstancedMesh;
  private starMat: THREE.MeshStandardMaterial;
  private dummy = new THREE.Object3D();

  // Faceless Luminous Companion Orb
  private companionGroup = new THREE.Group();
  private companionCoreMat: THREE.MeshStandardMaterial;
  private companionHaloMat: THREE.MeshBasicMaterial;
  private companionRingMesh: THREE.Mesh;
  private companionPos = new THREE.Vector3(1.1, 2.2, 4.1);

  // Central Hub Review Portal
  private portalGroup = new THREE.Group();
  private portalInnerMat: THREE.MeshBasicMaterial;
  private portalFrameMat: THREE.MeshStandardMaterial;
  private portalActive = false;

  // Lightweight mastery burst particles
  private burstPoints: THREE.Points;
  private burstVelocities: Float32Array;
  private burstLife = 0;

  private reducedMotion = false;

  constructor(initialCompanionColorId: string) {
    this.group.name = 'quest_gameplay_system';

    // 1. Build 20 daily-respawning Knowledge Stars (4 per island)
    this.stars = this.generateStarLayout();
    const starGeo = new THREE.OctahedronGeometry(0.28, 0);
    starGeo.scale(1, 1.35, 1);
    this.starMat = new THREE.MeshStandardMaterial({
      color: 0xf6c453,
      emissive: new THREE.Color(0xc8922b),
      emissiveIntensity: 0.72,
      roughness: 0.18,
      metalness: 0.78,
    });
    this.starMesh = new THREE.InstancedMesh(starGeo, this.starMat, this.stars.length);
    this.starMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.starMesh);

    // 2. Faceless Luminous Companion Orb (NO face, NO eyes, NO human form)
    const orbHex = resolveCosmeticHex(COMPANION_COLOR_OPTIONS, initialCompanionColorId, '#F6C453');
    this.companionCoreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(orbHex),
      emissive: new THREE.Color(orbHex),
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.2,
    });
    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      this.companionCoreMat
    );
    this.companionHaloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(orbHex),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const orbHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 12),
      this.companionHaloMat
    );
    this.companionRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.018, 8, 24),
      this.companionCoreMat
    );
    this.companionRingMesh.rotation.x = Math.PI * 0.35;
    this.companionGroup.add(orbCore, orbHalo, this.companionRingMesh);
    this.companionGroup.position.copy(this.companionPos);
    this.group.add(this.companionGroup);

    // 3. Central Hub Review Portal Archway
    this.portalFrameMat = new THREE.MeshStandardMaterial({
      color: 0xc8922b,
      emissive: new THREE.Color(0xc8922b),
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.75,
    });
    this.portalInnerMat = new THREE.MeshBasicMaterial({
      color: 0x3ad185,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const leftPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 2.2, 10),
      this.portalFrameMat
    );
    leftPillar.position.set(-0.95, 1.1, 0);
    const rightPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 2.2, 10),
      this.portalFrameMat
    );
    rightPillar.position.set(0.95, 1.1, 0);
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.12, 10, 24, Math.PI),
      this.portalFrameMat
    );
    arch.position.set(0, 2.15, 0);
    const shimmerPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 2.35),
      this.portalInnerMat
    );
    shimmerPlane.position.set(0, 1.35, 0);
    this.portalGroup.add(leftPillar, rightPillar, arch, shimmerPlane);
    this.portalGroup.position.set(REVIEW_PORTAL_POS.x, REVIEW_PORTAL_POS.y, REVIEW_PORTAL_POS.z);
    this.portalGroup.visible = false;
    this.group.add(this.portalGroup);

    // 4. Mastery Burst Particles
    const burstCount = 36;
    const posArr = new Float32Array(burstCount * 3);
    this.burstVelocities = new Float32Array(burstCount * 3);
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    this.burstPoints = new THREE.Points(
      burstGeo,
      new THREE.PointsMaterial({
        color: 0xf6c453,
        size: 0.32,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.burstPoints.visible = false;
    this.group.add(this.burstPoints);
  }

  private generateStarLayout(): KnowledgeStarPoint[] {
    const list: KnowledgeStarPoint[] = [];
    CHAPTERS.forEach((ch, chIdx) => {
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.35 + chIdx * 0.5;
        const r = ch.islandRadius * 0.54 + (i % 2) * 1.4;
        const rawX = ch.islandPos[0] + Math.cos(ang) * r;
        const rawZ = ch.islandPos[2] + Math.sin(ang) * r;
        const pushed = pushOutOfObstacles(rawX, rawZ, 0.7);
        const sy = islandSurfaceHeight(
          pushed.x - ch.islandPos[0],
          pushed.z - ch.islandPos[2],
          ch.islandRadius
        );
        list.push({
          id: `star_${ch.id}_${i + 1}`,
          chapterId: ch.id,
          x: pushed.x,
          y: ch.islandPos[1] + Math.max(0.78, sy) + 0.75,
          z: pushed.z,
          collected: false,
        });
      }
    });
    return list;
  }

  setReducedMotion(enabled: boolean) {
    this.reducedMotion = enabled;
  }

  setCompanionColor(colorId: string) {
    const hex = resolveCosmeticHex(COMPANION_COLOR_OPTIONS, colorId, '#F6C453');
    this.companionCoreMat.color.set(hex);
    this.companionCoreMat.emissive.set(hex);
    this.companionHaloMat.color.set(hex);
  }

  syncCollectedStars(collectedIds: string[]) {
    const set = new Set(collectedIds);
    this.stars.forEach((s) => {
      s.collected = set.has(s.id);
    });
  }

  setReviewPortalActive(active: boolean) {
    this.portalActive = active;
    this.portalGroup.visible = active;
  }

  triggerMasteryBurst(x: number, y: number, z: number) {
    if (this.reducedMotion) return;
    const posAttr = this.burstPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(i, x, y + 1.1, z);
      const ang = (i / posAttr.count) * Math.PI * 2;
      const spd = 1.6 + (i % 5) * 0.55;
      this.burstVelocities[i * 3] = Math.cos(ang) * spd;
      this.burstVelocities[i * 3 + 1] = 2.6 + (i % 4) * 0.8;
      this.burstVelocities[i * 3 + 2] = Math.sin(ang) * spd;
    }
    posAttr.needsUpdate = true;
    this.burstLife = 1.35;
    this.burstPoints.visible = true;
  }

  computeGuidance(
    playerPos: THREE.Vector3,
    cameraYaw: number,
    stationStates: Record<string, StationProgressState>,
    dueReviewCount: number
  ): QuestGuidanceState {
    const isMastered = (stId: string) => {
      const s = stationStates[stId];
      return Boolean(s?.challengePassed && s.stars >= 2);
    };

    // Find recommended chapter (first chapter in order with an unmastered station)
    let recChapter = CHAPTERS[0];
    let recStation = CHAPTERS[0].stations[0];
    let foundUnmastered = false;

    for (const ch of CHAPTERS) {
      const nextSt = ch.stations.find((st) => !isMastered(st.id));
      if (nextSt) {
        recChapter = ch;
        recStation = nextSt;
        foundUnmastered = true;
        break;
      }
    }

    // Highlight bridge leading to next unmastered chapter once previous chapter is mastered (or always guide first chapter if on hub)
    let recommendedBridgeChapterId: ChapterId | null = recChapter.id;
    if (!foundUnmastered) {
      recommendedBridgeChapterId = null;
    }

    // If review portal has urgent cards and player is in the central hub, suggest portal or next station
    const surf = getWalkableSurfaceAt(playerPos.x, playerPos.z);

    let targetPos = {
      x: recChapter.islandPos[0] + recStation.offsetOnIsland[0],
      y: recChapter.islandPos[1] + 1,
      z: recChapter.islandPos[2] + recStation.offsetOnIsland[1],
    };
    let targetTitle = foundUnmastered
      ? `${recChapter.shortTitle}: ${recStation.title}`
      : 'أتممت المحطات! واصل المراجعة وبنك الكراسة';
    let targetSubtitle = foundUnmastered
      ? `الوجهة المقترحة · محطة ${recStation.order}`
      : 'جميع المحطات متقنة ما شاء الله';

    if (dueReviewCount >= 3 && surf.zone === 'hub') {
      targetPos = { ...REVIEW_PORTAL_POS };
      targetTitle = `بوابة المراجعة الذكية (${dueReviewCount} بطاقات)`;
      targetSubtitle = 'توجّه شمال الساحة المركزية لتثبيت البطاقات المستحقة';
    }

    const dx = targetPos.x - playerPos.x;
    const dz = targetPos.z - playerPos.z;
    const distanceMeters = Math.round(Math.hypot(dx, dz));
    const worldAngle = Math.atan2(dx, dz);
    // Relative angle to camera facing vector (-sin(camYaw), -cos(camYaw))
    const camFacingAngle = Math.atan2(-Math.sin(cameraYaw), -Math.cos(cameraYaw));
    const compassAngleRad = worldAngle - camFacingAngle;

    let companionHint = 'تحرّك عبر الجسور المضيئة لاستكشاف جزر العقيدة الخمس.';
    if (dueReviewCount > 0 && surf.zone === 'hub') {
      companionHint = `تنتظرك ${dueReviewCount} بطاقات في بوابة المراجعة شمال الساحة المركزية.`;
    } else if (surf.zone === 'bridge' && surf.chapterId) {
      const bridgeCh = CHAPTERS.find((c) => c.id === surf.chapterId);
      companionHint = bridgeCh
        ? `أنت تعبر جسر ${bridgeCh.shortTitle} — اجمع نجوم المعرفة المضيئة في الجزيرة!`
        : companionHint;
    } else if (surf.chapterId) {
      companionHint = CHAPTER_SHORT_HINTS[surf.chapterId];
    } else if (foundUnmastered) {
      companionHint = `الوجهة الموصى بها الآن: ${recChapter.shortTitle} (${recStation.title}).`;
    }

    return {
      targetChapterId: recChapter.id,
      targetStationId: foundUnmastered ? recStation.id : null,
      targetTitle,
      targetSubtitle,
      targetPos,
      recommendedBridgeChapterId,
      compassAngleRad,
      distanceMeters,
      companionHint,
      reviewPortalActive: this.portalActive,
    };
  }

  getMinimapMarkers(stationStates: Record<string, StationProgressState>): MinimapMarker[] {
    const markers: MinimapMarker[] = [];
    for (const ch of CHAPTERS) {
      for (const st of ch.stations) {
        const stProg = stationStates[st.id];
        let status: MinimapMarker['status'] = 'unexplored';
        if (stProg?.challengePassed && stProg.stars >= 2) {
          status = 'mastered';
        } else if (stProg && (stProg.completedCardIds.length > 0 || stProg.challengePassed)) {
          status = 'in_progress';
        }
        markers.push({
          id: st.id,
          chapterId: ch.id,
          title: st.title,
          x: ch.islandPos[0] + st.offsetOnIsland[0],
          z: ch.islandPos[2] + st.offsetOnIsland[1],
          status,
        });
      }
    }
    return markers;
  }

  getRemainingStarsCount(): number {
    return this.stars.reduce((acc, s) => acc + (s.collected ? 0 : 1), 0);
  }

  update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    onCollectStar: (starId: string) => void
  ) {
    // 1. Update Knowledge Stars instanced mesh & check pickup distance
    let activeIdx = 0;
    for (const st of this.stars) {
      if (st.collected) continue;

      const dist = Math.hypot(playerPos.x - st.x, playerPos.z - st.z);
      if (dist <= 1.55 && Math.abs(playerPos.y - (st.y - 0.75)) < 2.2) {
        st.collected = true;
        onCollectStar(st.id);
        continue;
      }

      const bob = this.reducedMotion ? 0 : Math.sin(elapsed * 2.6 + st.x) * 0.14;
      this.dummy.position.set(st.x, st.y + bob, st.z);
      this.dummy.rotation.set(0, elapsed * 1.4 + st.z, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.starMesh.setMatrixAt(activeIdx, this.dummy.matrix);
      activeIdx++;
    }
    this.starMesh.count = activeIdx;
    this.starMesh.instanceMatrix.needsUpdate = true;

    // 2. Smooth Luminous Companion Orb follow (right-back shoulder offset)
    const offsetSide = Math.cos(playerYaw) * 0.95 - Math.sin(playerYaw) * -0.55;
    const offsetBack = -Math.sin(playerYaw) * 0.95 - Math.cos(playerYaw) * -0.55;
    const bobOrb = this.reducedMotion ? 0 : Math.sin(elapsed * 2.4) * 0.12;
    const desiredOrbX = playerPos.x + offsetSide;
    const desiredOrbY = playerPos.y + 1.65 + bobOrb;
    const desiredOrbZ = playerPos.z + offsetBack;

    this.companionPos.x = THREE.MathUtils.damp(this.companionPos.x, desiredOrbX, 6.5, dt);
    this.companionPos.y = THREE.MathUtils.damp(this.companionPos.y, desiredOrbY, 6.5, dt);
    this.companionPos.z = THREE.MathUtils.damp(this.companionPos.z, desiredOrbZ, 6.5, dt);
    this.companionGroup.position.copy(this.companionPos);

    if (!this.reducedMotion) {
      this.companionRingMesh.rotation.z = elapsed * 1.5;
      this.companionHaloMat.opacity = 0.22 + (Math.sin(elapsed * 3.1) + 1) * 0.08;
    }

    // 3. Review Portal pulse animation
    if (this.portalActive && !this.reducedMotion) {
      this.portalInnerMat.opacity = 0.38 + (Math.sin(elapsed * 3.2) + 1) * 0.12;
      this.portalFrameMat.emissiveIntensity = 0.35 + (Math.sin(elapsed * 2.2) + 1) * 0.15;
    }

    // 4. Mastery celebration burst particles
    if (this.burstLife > 0) {
      this.burstLife = Math.max(0, this.burstLife - dt);
      const posAttr = this.burstPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        this.burstVelocities[i * 3 + 1] -= 5.8 * dt;
        const nx = posAttr.getX(i) + this.burstVelocities[i * 3] * dt;
        const ny = posAttr.getY(i) + this.burstVelocities[i * 3 + 1] * dt;
        const nz = posAttr.getZ(i) + this.burstVelocities[i * 3 + 2] * dt;
        posAttr.setXYZ(i, nx, ny, nz);
      }
      posAttr.needsUpdate = true;
      (this.burstPoints.material as THREE.PointsMaterial).opacity = Math.min(1, this.burstLife);
      if (this.burstLife <= 0) {
        this.burstPoints.visible = false;
      }
    }
  }
}
