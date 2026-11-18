import React, { useRef, useState } from 'react';
import { ArrowUp, Compass, Footprints, Hand } from 'lucide-react';
import { InteractableTarget, MobileButtonSize } from '../../game/types';

interface MobileControlsProps {
  visible: boolean;
  buttonSize: MobileButtonSize;
  leftHanded: boolean;
  nearestTarget: InteractableTarget | null;
  onVirtualMove: (dx: number, dy: number) => void;
  onVirtualSprint: (active: boolean) => void;
  onJump: () => void;
  onInteract: () => void;
  onVibrate: (ms?: number) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  visible,
  buttonSize,
  leftHanded,
  nearestTarget,
  onVirtualMove,
  onVirtualSprint,
  onJump,
  onInteract,
  onVibrate,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSprinting, setIsSprinting] = useState(false);

  if (!visible) return null;

  const joyOuterSize = buttonSize === 'large' ? 124 : 108;
  const maxRadius = joyOuterSize * 0.36;
  const actionDimClass = buttonSize === 'large' ? 'h-16 w-16' : 'h-13 w-13';
  const interactDimClass =
    buttonSize === 'large' ? 'min-h-[60px] px-5 py-3 text-sm' : 'min-h-[52px] px-4 py-2.5 text-xs';

  const updateStickFromPoint = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    // Convert screen coordinates (+Y down) into normalized move (+Y forward/up)
    const nx = Math.abs(dx / maxRadius) < 0.14 ? 0 : dx / maxRadius;
    const ny = Math.abs(dy / maxRadius) < 0.14 ? 0 : -(dy / maxRadius);
    onVirtualMove(nx, ny);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onVirtualMove(0, 0);
  };

  const joystickBlock = (
    <div
      ref={padRef}
      role="group"
      aria-label="عصا التحكم بالحركة"
      onPointerDown={(e) => {
        e.stopPropagation();
        activePointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateStickFromPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        updateStickFromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        resetStick();
      }}
      onPointerCancel={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        resetStick();
      }}
      style={{
        width: joyOuterSize,
        height: joyOuterSize,
        touchAction: 'none',
      }}
      className="pointer-events-auto relative flex items-center justify-center rounded-full border-2 border-[#171C19]/20 bg-[#FBF9F4]/80 shadow-lg select-none"
    >
      <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-[#171C19]/15" />
      <div
        style={{
          transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
        }}
        className="pointer-events-none flex h-12 w-12 items-center justify-center rounded-full border border-[#1E6B47]/40 bg-[#1E6B47] text-white shadow-md transition-transform duration-75"
      >
        <Compass className="h-5 w-5" />
      </div>
    </div>
  );

  const actionsBlock = (
    <div
      className={`pointer-events-auto flex flex-col gap-2.5 select-none ${
        leftHanded ? 'items-start' : 'items-end'
      }`}
      style={{ touchAction: 'none' }}
    >
      {nearestTarget && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onVibrate(18);
            onInteract();
          }}
          aria-label={
            nearestTarget.kind === 'review_portal'
              ? 'افتح بوابة المراجعة'
              : `ابدأ المحطة: ${nearestTarget.title}`
          }
          className={`flex items-center gap-2 rounded-xl border border-[#C8922B] bg-[#1E6B47] font-bold text-white shadow-xl active:scale-95 ${interactDimClass}`}
        >
          <Hand className="h-5 w-5 shrink-0 text-[#F6C453]" />
          <span>
            {nearestTarget.kind === 'review_portal' ? 'افتح بوابة المراجعة' : 'ابدأ المحطة'}
          </span>
        </button>
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            const next = !isSprinting;
            setIsSprinting(next);
            onVirtualSprint(next);
            onVibrate(10);
          }}
          aria-pressed={isSprinting}
          aria-label="تبديل الجري"
          className={`flex flex-col items-center justify-center rounded-xl border font-bold shadow-md active:scale-95 ${actionDimClass} ${
            isSprinting
              ? 'border-[#C8922B] bg-[#C8922B] text-white'
              : 'border-[#171C19]/20 bg-[#FBF9F4]/90 text-[#171C19]'
          }`}
        >
          <Footprints className="h-5 w-5" />
          <span className="text-[10px]">جري</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onVibrate(12);
            onJump();
          }}
          aria-label="قفز"
          className={`flex flex-col items-center justify-center rounded-xl border border-[#171C19]/20 bg-[#FBF9F4]/90 font-bold text-[#171C19] shadow-md active:scale-95 ${actionDimClass}`}
        >
          <ArrowUp className="h-5 w-5 text-[#1E6B47]" />
          <span className="text-[10px]">قفز</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      dir="ltr"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-18 flex items-end justify-between px-4 pb-20 sm:pb-24"
      style={{
        paddingBottom: 'calc(max(4.75rem, env(safe-area-inset-bottom) + 4.25rem))',
        paddingLeft: 'calc(max(1rem, env(safe-area-inset-left)))',
        paddingRight: 'calc(max(1rem, env(safe-area-inset-right)))',
        touchAction: 'none',
      }}
    >
      {leftHanded ? (
        <>
          {actionsBlock}
          {joystickBlock}
        </>
      ) : (
        <>
          {joystickBlock}
          {actionsBlock}
        </>
      )}
    </div>
  );
};
