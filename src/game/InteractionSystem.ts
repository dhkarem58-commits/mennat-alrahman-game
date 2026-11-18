import * as THREE from 'three';
import { CHAPTERS } from '../curriculum';
import { HUB_CENTER } from '../scene/ProceduralAssets';
import { InteractableTarget } from './types';

export const REVIEW_PORTAL_POS = { x: HUB_CENTER.x, y: HUB_CENTER.surfaceY, z: HUB_CENTER.z - 3.2 };

export class InteractionSystem {
  private lastKey = '';
  private currentNearest: InteractableTarget | null = null;
  private proximityRadius = 3.7;

  getNearest(): InteractableTarget | null {
    return this.currentNearest;
  }

  update(
    playerPos: THREE.Vector3,
    reviewPortalActive: boolean,
    onNearestChange: (target: InteractableTarget | null) => void
  ): InteractableTarget | null {
    let best: InteractableTarget | null = null;
    let bestDist = this.proximityRadius;

    // 1. Check Review Portal at Central Hub when due cards exist
    if (reviewPortalActive) {
      const pd = Math.hypot(
        playerPos.x - REVIEW_PORTAL_POS.x,
        playerPos.z - REVIEW_PORTAL_POS.z
      );
      if (pd <= 3.1 && pd < bestDist) {
        bestDist = pd;
        best = {
          kind: 'review_portal',
          id: 'hub_review_portal',
          title: 'بوابة المراجعة الذكية',
          subtitle: 'راجع البطاقات المستحقة لتثبيت الحفظ',
          distance: pd,
        };
      }
    }

    // 2. Check all Chapter Stations
    for (const ch of CHAPTERS) {
      for (const st of ch.stations) {
        const sx = ch.islandPos[0] + st.offsetOnIsland[0];
        const sz = ch.islandPos[2] + st.offsetOnIsland[1];
        const d = Math.hypot(playerPos.x - sx, playerPos.z - sz);
        if (d <= bestDist) {
          bestDist = d;
          best = {
            kind: 'station',
            id: st.id,
            chapterId: ch.id,
            title: st.title,
            subtitle: ch.shortTitle,
            distance: d,
          };
        }
      }
    }

    const nextKey = best ? `${best.kind}:${best.id}` : '';
    if (nextKey !== this.lastKey) {
      this.lastKey = nextKey;
      this.currentNearest = best;
      onNearestChange(best);
    } else if (best && this.currentNearest) {
      this.currentNearest = best;
    }

    return this.currentNearest;
  }
}
