export interface InputFrameState {
  moveX: number; // -1..1 (right positive)
  moveY: number; // -1..1 (forward positive)
  lookDeltaX: number; // radians delta
  lookDeltaY: number; // radians delta
  zoomDelta: number;
  sprint: boolean;
  jumpPressed: boolean;
  interactPressed: boolean;
  isMovingInput: boolean;
}

export interface InputSystemCallbacks {
  onTogglePause?: () => void;
  onToggleMap?: () => void;
  onCycleCameraMode?: () => void;
}

export class InputManager {
  private dom: HTMLElement;
  private callbacks: InputSystemCallbacks;

  private keys = new Set<string>();
  private virtualMove = { x: 0, y: 0 };
  private virtualSprint = false;
  private jumpQueued = false;
  private interactQueued = false;

  private lookAccumX = 0;
  private lookAccumY = 0;
  private zoomAccum = 0;

  // Mouse drag orbit tracking (only in player camera mode when user drags canvas)
  private activeMouseDrag = false;
  private lastMouse = { x: 0, y: 0 };

  // Multi-touch tracking directly on canvas (camera drag + pinch zoom)
  private canvasTouches = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;

  private cameraOrbitEnabled = true;
  private sensitivity = 1.0;
  private isPaused = false;
  private coarseQuery: MediaQueryList | null = null;
  private isTouch = false;
  private touchListeners = new Set<(isTouch: boolean) => void>();

  constructor(dom: HTMLElement, callbacks: InputSystemCallbacks = {}) {
    this.dom = dom;
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      this.coarseQuery = window.matchMedia?.('(pointer: coarse)') ?? null;
      this.isTouch = Boolean(
        this.coarseQuery?.matches ||
          (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
      );
      this.coarseQuery?.addEventListener?.('change', this.handlePointerMediaChange);
    }

    this.attachEvents();
  }

  private handlePointerMediaChange = () => {
    const next = Boolean(
      this.coarseQuery?.matches ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    );
    if (next !== this.isTouch) {
      this.isTouch = next;
      this.touchListeners.forEach((cb) => cb(this.isTouch));
    }
  };

  subscribeTouchDevice(cb: (isTouch: boolean) => void): () => void {
    this.touchListeners.add(cb);
    cb(this.isTouch);
    return () => {
      this.touchListeners.delete(cb);
    };
  }

  isTouchDevice(): boolean {
    return this.isTouch;
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.keys.clear();
      this.virtualMove = { x: 0, y: 0 };
      this.virtualSprint = false;
      this.activeMouseDrag = false;
      this.canvasTouches.clear();
      this.lastPinchDist = null;
    }
  }

  setCameraOrbitEnabled(enabled: boolean) {
    this.cameraOrbitEnabled = enabled;
    if (!enabled) {
      this.activeMouseDrag = false;
      this.lookAccumX = 0;
      this.lookAccumY = 0;
      this.zoomAccum = 0;
    }
  }

  setSensitivity(value: number) {
    this.sensitivity = Math.max(0.35, Math.min(2.5, value));
  }

  setVirtualMove(dx: number, dy: number) {
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      this.virtualMove.x = dx / len;
      this.virtualMove.y = dy / len;
    } else {
      this.virtualMove.x = dx;
      this.virtualMove.y = dy;
    }
  }

  setVirtualSprint(active: boolean) {
    this.virtualSprint = active;
  }

  triggerJump() {
    if (!this.isPaused) {
      this.jumpQueued = true;
    }
  }

  triggerInteract() {
    if (!this.isPaused) {
      this.interactQueued = true;
    }
  }

  vibrate(durationMs = 14) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignore unsupported haptic calls
      }
    }
  }

  private isTypingOrModalTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
      return true;
    }
    return false;
  }

  private hasOpenDialog(): boolean {
    return typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"]'));
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (!this.hasOpenDialog()) {
        this.callbacks.onTogglePause?.();
      }
      return;
    }

    if (this.isTypingOrModalTarget(e.target) || this.hasOpenDialog() || this.isPaused) {
      return;
    }

    if (e.code === 'KeyM' && !e.repeat) {
      this.callbacks.onToggleMap?.();
      return;
    }
    if (e.code === 'KeyC' && !e.repeat) {
      this.callbacks.onCycleCameraMode?.();
      return;
    }
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.jumpQueued = true;
    }
    if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) {
      if (!(e.target instanceof HTMLButtonElement)) {
        this.interactQueued = true;
      }
    }

    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleWindowBlur = () => {
    this.keys.clear();
    this.activeMouseDrag = false;
    this.canvasTouches.clear();
    this.lastPinchDist = null;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (!this.cameraOrbitEnabled || this.isPaused) return;
    if (e.button !== 0 && e.button !== 2) return;
    this.activeMouseDrag = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.cameraOrbitEnabled || !this.activeMouseDrag || this.isPaused) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.lastMouse = { x: e.clientX, y: e.clientY };
    const factor = 0.0052 * this.sensitivity;
    this.lookAccumX -= dx * factor;
    this.lookAccumY += dy * factor;
  };

  private handleMouseUp = () => {
    this.activeMouseDrag = false;
  };

  private handleWheel = (e: WheelEvent) => {
    if (!this.cameraOrbitEnabled || this.isPaused) return;
    this.zoomAccum += Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 0.015, 2.2);
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.isTouch) {
      this.isTouch = true;
      this.touchListeners.forEach((cb) => cb(true));
    }
    if (!this.cameraOrbitEnabled || this.isPaused) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      this.canvasTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (this.canvasTouches.size === 2) {
      const pts = Array.from(this.canvasTouches.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.cameraOrbitEnabled || this.isPaused) return;
    if (this.canvasTouches.size === 1) {
      const t = e.changedTouches[0];
      const prev = this.canvasTouches.get(t.identifier);
      if (prev) {
        const dx = t.clientX - prev.x;
        const dy = t.clientY - prev.y;
        const factor = 0.0065 * this.sensitivity;
        this.lookAccumX -= dx * factor;
        this.lookAccumY += dy * factor;
        this.canvasTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    } else if (this.canvasTouches.size >= 2) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.canvasTouches.has(t.identifier)) {
          this.canvasTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      }
      const pts = Array.from(this.canvasTouches.values());
      if (pts.length >= 2) {
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.lastPinchDist !== null) {
          this.zoomAccum += (this.lastPinchDist - dist) * 0.045;
        }
        this.lastPinchDist = dist;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.canvasTouches.delete(e.changedTouches[i].identifier);
    }
    if (this.canvasTouches.size < 2) {
      this.lastPinchDist = null;
    }
  };

  private prevGamepadButtons: boolean[] = [];

  private pollGamepad(state: InputFrameState, dt: number) {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    const gp = pads?.[0];
    if (!gp) return;

    const deadzone = 0.18;
    const lx = Math.abs(gp.axes[0] ?? 0) > deadzone ? (gp.axes[0] ?? 0) : 0;
    const ly = Math.abs(gp.axes[1] ?? 0) > deadzone ? -(gp.axes[1] ?? 0) : 0;
    if (Math.hypot(lx, ly) > 0.05) {
      state.moveX = Math.max(-1, Math.min(1, state.moveX + lx));
      state.moveY = Math.max(-1, Math.min(1, state.moveY + ly));
    }

    const rx = Math.abs(gp.axes[2] ?? 0) > deadzone ? (gp.axes[2] ?? 0) : 0;
    const ry = Math.abs(gp.axes[3] ?? 0) > deadzone ? (gp.axes[3] ?? 0) : 0;
    if (rx !== 0 || ry !== 0) {
      state.lookDeltaX -= rx * 2.1 * this.sensitivity * dt;
      state.lookDeltaY += ry * 1.4 * this.sensitivity * dt;
    }

    const btnJump = Boolean(gp.buttons[0]?.pressed);
    const btnInteract = Boolean(gp.buttons[2]?.pressed || gp.buttons[3]?.pressed);
    const btnSprint = Boolean(gp.buttons[1]?.pressed || gp.buttons[4]?.pressed || gp.buttons[5]?.pressed);
    const btnPause = Boolean(gp.buttons[9]?.pressed);

    if (btnJump && !this.prevGamepadButtons[0]) state.jumpPressed = true;
    if (btnInteract && !this.prevGamepadButtons[2]) state.interactPressed = true;
    if (btnPause && !this.prevGamepadButtons[9]) this.callbacks.onTogglePause?.();
    if (btnSprint) state.sprint = true;

    this.prevGamepadButtons = [btnJump, false, btnInteract, false, false, false, false, false, false, btnPause];
  }

  sampleFrame(dt: number): InputFrameState {
    if (this.isPaused || this.hasOpenDialog()) {
      this.lookAccumX = 0;
      this.lookAccumY = 0;
      this.zoomAccum = 0;
      this.jumpQueued = false;
      this.interactQueued = false;
      return {
        moveX: 0,
        moveY: 0,
        lookDeltaX: 0,
        lookDeltaY: 0,
        zoomDelta: 0,
        sprint: false,
        jumpPressed: false,
        interactPressed: false,
        isMovingInput: false,
      };
    }

    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;

    let moveX = kx + this.virtualMove.x;
    let moveY = ky + this.virtualMove.y;
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    const state: InputFrameState = {
      moveX,
      moveY,
      lookDeltaX: this.lookAccumX,
      lookDeltaY: this.lookAccumY,
      zoomDelta: this.zoomAccum,
      sprint:
        this.virtualSprint ||
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight'),
      jumpPressed: this.jumpQueued,
      interactPressed: this.interactQueued,
      isMovingInput: len > 0.08,
    };

    this.pollGamepad(state, dt);
    state.isMovingInput = Math.hypot(state.moveX, state.moveY) > 0.08;

    this.lookAccumX = 0;
    this.lookAccumY = 0;
    this.zoomAccum = 0;
    this.jumpQueued = false;
    this.interactQueued = false;

    return state;
  }

  private attachEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);

    this.dom.addEventListener('mousedown', this.handleMouseDown);
    this.dom.addEventListener('wheel', this.handleWheel, { passive: true });
    this.dom.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.dom.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    this.dom.addEventListener('touchend', this.handleTouchEnd);
    this.dom.addEventListener('touchcancel', this.handleTouchEnd);
  }

  dispose() {
    this.coarseQuery?.removeEventListener?.('change', this.handlePointerMediaChange);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);

    this.dom.removeEventListener('mousedown', this.handleMouseDown);
    this.dom.removeEventListener('wheel', this.handleWheel);
    this.dom.removeEventListener('touchstart', this.handleTouchStart);
    this.dom.removeEventListener('touchmove', this.handleTouchMove);
    this.dom.removeEventListener('touchend', this.handleTouchEnd);
    this.dom.removeEventListener('touchcancel', this.handleTouchEnd);
  }
}
