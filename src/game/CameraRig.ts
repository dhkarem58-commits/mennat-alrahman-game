import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ARCHIPELAGO_OBSTACLES,
  getWalkableSurfaceAt,
} from '../scene/ProceduralAssets';
import { InputFrameState } from './InputManager';
import { CameraMode } from './types';

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private mode: CameraMode = 'player';
  private yaw = 0; // 0 => camera sits at +Z looking toward -Z
  private pitch = 0.44;
  private distance = 11.5;

  private smoothTarget = new THREE.Vector3(0, 1.8, 4.1);
  private smoothCamPos = new THREE.Vector3(0, 6.5, 14.5);

  private orbitDesiredPos = new THREE.Vector3(0, 34, 58);
  private orbitDesiredTarget = new THREE.Vector3(0, 2, 6);
  private isFlyingOrbit = false;

  // Optional temporary focus while StationModal is open in player mode
  private stationFocusTarget: THREE.Vector3 | null = null;
  private stationFocusCamPos: THREE.Vector3 | null = null;

  // Micro camera shake
  private shakeTimeLeft = 0;
  private shakeIntensity = 0;
  private reducedMotion = false;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
    this.applyModeSettings();
  }

  getMode(): CameraMode {
    return this.mode;
  }

  getYaw(): number {
    return this.yaw;
  }

  setReducedMotion(enabled: boolean) {
    this.reducedMotion = enabled;
  }

  setMode(nextMode: CameraMode, playerPos?: THREE.Vector3) {
    if (this.mode === nextMode) return;
    this.mode = nextMode;
    this.stationFocusTarget = null;
    this.stationFocusCamPos = null;
    this.isFlyingOrbit = false;

    if (nextMode === 'orbit') {
      if (playerPos) {
        this.controls.target.set(playerPos.x, playerPos.y + 1.2, playerPos.z);
      }
      this.controls.enabled = true;
    } else if (nextMode === 'topdown') {
      this.controls.enabled = false;
    } else {
      this.controls.enabled = false;
      if (playerPos) {
        this.smoothTarget.set(playerPos.x, playerPos.y + 1.45, playerPos.z);
      }
    }
    this.applyModeSettings();
  }

  private applyModeSettings() {
    this.controls.enabled = this.mode === 'orbit';
  }

  flyOrbitTo(camPos: THREE.Vector3, targetPos: THREE.Vector3) {
    this.orbitDesiredPos.copy(camPos);
    this.orbitDesiredTarget.copy(targetPos);
    this.isFlyingOrbit = true;
  }

  cancelOrbitFlight() {
    this.isFlyingOrbit = false;
  }

  focusStationTemporarily(stationPos: THREE.Vector3) {
    this.stationFocusTarget = new THREE.Vector3(
      stationPos.x,
      stationPos.y + 1.15,
      stationPos.z
    );
    this.stationFocusCamPos = new THREE.Vector3(
      stationPos.x + 5.2,
      stationPos.y + 6.2,
      stationPos.z + 8.4
    );
  }

  clearStationFocus() {
    this.stationFocusTarget = null;
    this.stationFocusCamPos = null;
  }

  triggerShake(intensity = 0.16, duration = 0.32) {
    if (this.reducedMotion) return;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimeLeft = Math.max(this.shakeTimeLeft, duration);
  }

  update(dt: number, playerPos: THREE.Vector3, input: InputFrameState) {
    if (this.mode === 'orbit') {
      if (this.isFlyingOrbit) {
        const lambda = 4.8;
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.orbitDesiredPos.x, lambda, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.orbitDesiredPos.y, lambda, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.orbitDesiredPos.z, lambda, dt);
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.orbitDesiredTarget.x, lambda, dt);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.orbitDesiredTarget.y, lambda, dt);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.orbitDesiredTarget.z, lambda, dt);
        if (
          this.camera.position.distanceTo(this.orbitDesiredPos) < 0.08 &&
          this.controls.target.distanceTo(this.orbitDesiredTarget) < 0.05
        ) {
          this.isFlyingOrbit = false;
        }
      }
      this.controls.update();
      this.applyShake(dt);
      return;
    }

    if (this.mode === 'topdown') {
      const targetX = playerPos.x * 0.35;
      const targetZ = playerPos.z * 0.35 + 4;
      this.smoothTarget.x = THREE.MathUtils.damp(this.smoothTarget.x, targetX, 5, dt);
      this.smoothTarget.y = THREE.MathUtils.damp(this.smoothTarget.y, 0.8, 5, dt);
      this.smoothTarget.z = THREE.MathUtils.damp(this.smoothTarget.z, targetZ, 5, dt);

      this.smoothCamPos.x = THREE.MathUtils.damp(this.smoothCamPos.x, targetX, 5, dt);
      this.smoothCamPos.y = THREE.MathUtils.damp(this.smoothCamPos.y, 72, 5, dt);
      this.smoothCamPos.z = THREE.MathUtils.damp(this.smoothCamPos.z, targetZ + 12, 5, dt);

      this.camera.position.copy(this.smoothCamPos);
      this.camera.lookAt(this.smoothTarget);
      this.applyShake(dt);
      return;
    }

    // Player 3rd-person follow mode
    if (this.stationFocusTarget && this.stationFocusCamPos) {
      this.smoothTarget.lerp(this.stationFocusTarget, Math.min(1, dt * 6));
      this.smoothCamPos.lerp(this.stationFocusCamPos, Math.min(1, dt * 6));
      this.camera.position.copy(this.smoothCamPos);
      this.camera.lookAt(this.smoothTarget);
      this.applyShake(dt);
      return;
    }

    // Apply player orbit & zoom input
    this.yaw += input.lookDeltaX;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.lookDeltaY, 0.16, 1.18);
    this.distance = THREE.MathUtils.clamp(this.distance + input.zoomDelta, 5.8, 26);

    const desiredTargetX = playerPos.x;
    const desiredTargetY = playerPos.y + 1.45;
    const desiredTargetZ = playerPos.z;

    this.smoothTarget.x = THREE.MathUtils.damp(this.smoothTarget.x, desiredTargetX, 11, dt);
    this.smoothTarget.y = THREE.MathUtils.damp(this.smoothTarget.y, desiredTargetY, 11, dt);
    this.smoothTarget.z = THREE.MathUtils.damp(this.smoothTarget.z, desiredTargetZ, 11, dt);

    // Compute unobstructed camera distance along view ray against obstacles & island floors
    const horizDist = Math.cos(this.pitch) * this.distance;
    const dirX = Math.sin(this.yaw);
    const dirZ = Math.cos(this.yaw);
    const desiredVert = Math.sin(this.pitch) * this.distance;

    let safeFactor = 1.0;
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const sx = desiredTargetX + dirX * horizDist * f;
      const sz = desiredTargetZ + dirZ * horizDist * f;
      const sy = desiredTargetY + desiredVert * f;

      for (const obs of ARCHIPELAGO_OBSTACLES) {
        if (sy < playerPos.y + obs.height) {
          const od = Math.hypot(sx - obs.x, sz - obs.z);
          if (od < obs.radius + 0.55) {
            safeFactor = Math.min(safeFactor, Math.max(0.32, f - 0.14));
          }
        }
      }
    }

    const effDist = this.distance * safeFactor;
    let idealCamX = this.smoothTarget.x + dirX * Math.cos(this.pitch) * effDist;
    let idealCamY = this.smoothTarget.y + Math.sin(this.pitch) * effDist;
    let idealCamZ = this.smoothTarget.z + dirZ * Math.cos(this.pitch) * effDist;

    // Prevent camera from dipping below walkable terrain surfaces
    const terrainUnderCam = getWalkableSurfaceAt(idealCamX, idealCamZ);
    if (terrainUnderCam.walkable) {
      idealCamY = Math.max(idealCamY, terrainUnderCam.groundY + 1.05);
    } else {
      idealCamY = Math.max(idealCamY, 1.4);
    }

    const camLambda = this.reducedMotion ? 20 : 10;
    this.smoothCamPos.x = THREE.MathUtils.damp(this.smoothCamPos.x, idealCamX, camLambda, dt);
    this.smoothCamPos.y = THREE.MathUtils.damp(this.smoothCamPos.y, idealCamY, camLambda, dt);
    this.smoothCamPos.z = THREE.MathUtils.damp(this.smoothCamPos.z, idealCamZ, camLambda, dt);

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothTarget);
    this.applyShake(dt);
  }

  private applyShake(dt: number) {
    if (this.shakeTimeLeft <= 0 || this.reducedMotion) return;
    this.shakeTimeLeft = Math.max(0, this.shakeTimeLeft - dt);
    const decay = this.shakeTimeLeft * 3;
    const amp = this.shakeIntensity * Math.min(1, decay);
    this.camera.position.x += (Math.random() - 0.5) * 2 * amp;
    this.camera.position.y += (Math.random() - 0.5) * 2 * amp;
    if (this.shakeTimeLeft <= 0) {
      this.shakeIntensity = 0;
    }
  }
}
