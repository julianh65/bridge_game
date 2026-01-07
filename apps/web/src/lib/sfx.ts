import bellUrl from "../assets/sfx/single-church-bell-2-352062.mp3";
import clickUrl from "../assets/sfx/click-buttons-ui-menu-sounds-effects-button-14-205402.mp3";
import errorUrl from "../assets/sfx/error-002-337159.mp3";
import softUrl from "../assets/sfx/computer-mouse-click-351398.mp3";

export type SfxName = "click" | "soft" | "error" | "bell";

const SFX_FILES: Record<SfxName, string> = {
  click: clickUrl,
  soft: softUrl,
  error: errorUrl,
  bell: bellUrl
};

const SFX_VOLUME: Record<SfxName, number> = {
  click: 0.28,
  soft: 0.22,
  error: 0.4,
  bell: 0.5
};

const audioPools: Record<SfxName, HTMLAudioElement[]> = {
  click: [],
  soft: [],
  error: [],
  bell: []
};

let isArmed = false;

export const armSfx = () => {
  isArmed = true;
};

export const getSfxForTarget = (target: EventTarget | null): SfxName | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const override = target.closest<HTMLElement>("[data-sfx]")?.dataset.sfx;
  if (override === "click" || override === "soft" || override === "error" || override === "bell") {
    return override;
  }
  if (target.closest("button,[role=\"button\"],a")) {
    return "click";
  }
  return null;
};

const getAudio = (name: SfxName) => {
  const pool = audioPools[name];
  let audio = pool.find((item) => item.paused || item.ended);
  if (!audio) {
    audio = new Audio(SFX_FILES[name]);
    audio.preload = "auto";
    pool.push(audio);
  }
  audio.currentTime = 0;
  return audio;
};

export const playSfx = (name: SfxName) => {
  if (!isArmed) {
    return;
  }
  const audio = getAudio(name);
  audio.volume = SFX_VOLUME[name];
  audio.play().catch(() => {
    // Ignore autoplay/permission errors.
  });
};
