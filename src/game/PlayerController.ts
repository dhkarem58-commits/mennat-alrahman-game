import * as THREE from 'three';
import {
  buildStudentAvatarRig,
  getNearestSafeWalkablePoint,
  getWalkableSurfaceAt,
  resolveCosmeticHex,
  resolveWalkableMovement,
  StudentAvatarRig,
} from '../scene/ProceduralAssets';
import { InputFrameState } from './InputManager';
import {
  AvatarConfig,
  PlayerPositionState,
  ROBE_COLOR_OPTIONS,
  SATCHEL_COLOR_OPTIONS,
} from './types';

interface AutoWalkTarget {
  x: number;
  z: number;
  stopRadius: number;
  onArrive?: () => void;
}

export class PlayerController {
  readonly rig: StudentAvatarRig;
  readonly position = new THREE.Vector3(0, 0.75, 4.1);
  yaw = Math.PI;

  private velocityY = 0;
  private isGrounded = true;
  private currentGroundY = 0.75;
  private animPhase = 0;
  private autoWalk: AutoWalkTarget | null = null;
  private lastSafePos = new THREE.Vector3(0, 0.75, 4.1);
  private reducedMotion = false;
  private isMovingNow = false;

  constructor(initialConfig: AvatarConfig, initialPos?: PlayerPositionState) {
    this.rig = buildStudentAvatarRig(initialConfig);

    if (initialPos) {
      const safe = getNearestSafeWalkablePoint(initialPos.x, initialPos.z);
      this.position.set(safe.x, safe.y, safe.z);
      this.currentGroundY = safe.y;
      this.yaw = initialPos.yaw ?? Math.PI;
    } else {
      const safe = getNearestSafeWalkablePoint(0, 4.1);
      this.position.set(safe.x, safe.y, safe.z);
      this.currentGroundY = safe.y;
    }

    this.lastSafePos.copy(this.position);
    this.syncRigTransform();
  }

  setReducedMotion(enabled: boolean) {
    this.reducedMotion = enabled;
  }

  isCurrentlyMoving(): boolean {
    return this.isMovingNow;
  }

  updateAppearance(config: AvatarConfig) {
    this.rig.boyGroup.visible = config.gender === 'boy';
    this.rig.girlGroup.visible = config.gender === 'girl';
    this.rig.robeMat.color.set(
      resolveCosmeticHex(ROBE_COLOR_OPTIONS, config.robeColorId, '#F3EFE4')
    );
    this.rig.satchelMat.color.set(
      resolveCosmeticHex(SATCHEL_COLOR_OPTIONS, config.satchelColorId, '#6E472B')
    );
  }

  teleportTo(x: number, z: number, yaw?: number) {
    const safe = getNearestSafeWalkablePoint(x, z);
    this.position.set(safe.x, safe.y, safe.z);
    this.lastSafePos.copy(this.position);
    this.currentGroundY = safe.y;
    this.velocityY = 0;
    this.isGrounded = true;
    this.autoWalk = null;
    if (yaw !== undefined) {
      this.yaw = yaw;
    }
    this.syncRigTransform();
  }

  walkTo(x: number, z: number, stopRadius = 2.6, onArrive?: () => void) {
    this.autoWalk = { x, z, stopRadius, onArrive };
  }

  cancelAutoWalk() {
    this.autoWalk = null;
  }

  getSnapshot(): PlayerPositionState {
    return {
      x: Number(this.lastSafePos.x.toFixed(2)),
      y: Number(this.lastSafePos.y.toFixed(2)),
      z: Number(this.lastSafePos.z.toFixed(2)),
      yaw: Number(this.yaw.toFixed(3)),
    };
  }

  update(dt: number, elapsed: number, input: InputFrameState, cameraYaw: number) {
    let worldMoveX = 0;
    let worldMoveZ = 0;
    let speedMultiplier = 0;

    if (input.isMovingInput) {
      // Any manual player input cancels click-to-walk
      this.autoWalk = null;

      // Camera-relative basis in XZ plane
      const fwdX = -Math.sin(cameraYaw);
      const fwdZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      worldMoveX = fwdX * input.moveY + rightX * input.moveX;
      worldMoveZ = fwdZ * input.moveY + rightZ * input.moveX;
      const mag = Math.hypot(worldMoveX, worldMoveZ);
      if (mag > 0.001) {
        worldMoveX /= mag;
        worldMoveZ /= mag;
      }
      speedMultiplier = Math.min(1, Math.hypot(input.moveX, input.moveY));
    } else if (this.autoWalk) {
      const dx = this.autoWalk.x - this.position.x;
      const dz = this.autoWalk.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= this.autoWalk.stopRadius) {
        const arriveCb = this.autoWalk.onArrive;
        this.autoWalk = null;
        arriveCb?.();
      } else {
        worldMoveX = dx / dist;
        worldMoveZ = dz / dist;
        speedMultiplier = 1;
      }
    }

    const isMoving = speedMultiplier > 0.05;
    const isSprinting = isMoving && (input.sprint || Boolean(this.autoWalk));
    const moveSpeed = (isSprinting ? 10.2 : 6.2) * speedMultiplier;

    this.isMovingNow = isMoving;

    if (isMoving) {
      const nextX = this.position.x + worldMoveX * moveSpeed * dt;
      const nextZ = this.position.z + worldMoveZ * moveSpeed * dt;
      const resolved = resolveWalkableMovement(this.position.x, this.position.z, nextX, nextZ);

      this.position.x = resolved.x;
      this.position.z = resolved.z;
      this.currentGroundY = resolved.surface.groundY;
      this.lastSafePos.set(resolved.x, resolved.surface.groundY, resolved.z);

      // Stop auto-walk cleanly if blocked by curb while trying to walk across non-bridge gap
      if (this.autoWalk && resolved.blockedByEdge) {
        const remain = Math.hypot(
          this.autoWalk.x - this.position.x,
          this.autoWalk.z - this.position.z
        );
        if (remain > this.autoWalk.stopRadius + 1.5 && resolved.surface.zone === 'island') {
          // Teleport near target bridge-less jump fallback shouldn't strand player
        }
      }

      const targetYaw = Math.atan2(worldMoveX, worldMoveZ);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 12);
    } else {
      const surf = getWalkableSurfaceAt(this.position.x, this.position.z);
      if (surf.walkable) {
        this.currentGroundY = surf.groundY;
      } else {
        this.position.copy(this.lastSafePos);
        this.currentGroundY = this.lastSafePos.y;
      }
    }

    // Jump & gravity
    if (input.jumpPressed && this.isGrounded) {
      this.velocityY = 8.4;
      this.isGrounded = false;
    }

    if (!this.isGrounded || this.position.y > this.currentGroundY + 0.01) {
      this.velocityY -= 23.5 * dt;
      this.position.y += this.velocityY * dt;
      if (this.position.y <= this.currentGroundY) {
        this.position.y = this.currentGroundY;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    } else {
      this.position.y = THREE.MathUtils.damp(this.position.y, this.currentGroundY, 18, dt);
      this.isGrounded = true;
    }

    this.animateLimbs(dt, elapsed, isMoving, isSprinting);
    this.syncRigTransform();
  }

  private animateLimbs(
    dt: number,
    elapsed: number,
    isMoving: boolean,
    isSprinting: boolean
  ) {
    const heightAboveGround = Math.max(0, this.position.y - this.currentGroundY);
    const shadowScale = Math.max(0.55, 1 - heightAboveGround * 0.16);
    this.rig.shadowDisc.scale.setScalar(shadowScale);
    this.rig.shadowDisc.position.y = -heightAboveGround + 0.025;

    if (this.reducedMotion) {
      this.rig.leftArmPivot.rotation.x = 0;
      this.rig.rightArmPivot.rotation.x = 0;
      this.rig.leftLegPivot.rotation.x = 0;
      this.rig.rightLegPivot.rotation.x = 0;
      this.rig.bodyPivot.position.y = 0;
      this.rig.bodyPivot.rotation.x = 0;
      return;
    }

    if (!this.isGrounded) {
      // Airborne pose
      this.rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.rig.leftLegPivot.rotation.x, 0.35, 10, dt);
      this.rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rig.rightLegPivot.rotation.x, -0.25, 10, dt);
      this.rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.rig.leftArmPivot.rotation.x, -0.55, 10, dt);
      this.rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rig.rightArmPivot.rotation.x, -0.45, 10, dt);
      this.rig.bodyPivot.rotation.x = THREE.MathUtils.damp(this.rig.bodyPivot.rotation.x, 0.05, 8, dt);
      return;
    }

    if (isMoving) {
      const cycleSpeed = isSprinting ? 13.5 : 8.5;
      const amplitude = isSprinting ? 0.56 : 0.36;
      this.animPhase += dt * cycleSpeed;

      const swing = Math.sin(this.animPhase) * amplitude;
      const bounce = Math.abs(Math.cos(this.animPhase)) * (isSprinting ? 0.08 : 0.045);

      this.rig.leftLegPivot.rotation.x = swing;
      this.rig.rightLegPivot.rotation.x = -swing;
      this.rig.leftArmPivot.rotation.x = -swing * 0.78;
      this.rig.rightArmPivot.rotation.x = swing * 0.78;
      this.rig.bodyPivot.position.y = bounce;
      this.rig.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.rig.bodyPivot.rotation.x,
        isSprinting ? 0.13 : 0.04,
        10,
        dt
      );
      this.rig.headPivot.rotation.y = THREE.MathUtils.damp(this.rig.headPivot.rotation.y, 0, 8, dt);
    } else {
      // Serene idle breathing
      const breath = Math.sin(elapsed * 2.1);
      this.rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.rig.leftLegPivot.rotation.x, 0, 12, dt);
      this.rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rig.rightLegPivot.rotation.x, 0, 12, dt);
      this.rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.rig.leftArmPivot.rotation.x, breath * 0.03, 10, dt);
      this.rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rig.rightArmPivot.rotation.x, -breath * 0.03, 10, dt);
      this.rig.bodyPivot.position.y = THREE.MathUtils.damp(
        this.rig.bodyPivot.position.y,
        (breath + 1) * 0.015,
        8,
        dt
      );
      this.rig.bodyPivot.rotation.x = THREE.MathUtils.damp(this.rig.bodyPivot.rotation.x, 0, 10, dt);
      this.rig.headPivot.rotation.y = Math.sin(elapsed * 0.7) * 0.06;
    }
  }

  private syncRigTransform() {
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;
  }
}
