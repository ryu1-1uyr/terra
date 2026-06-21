import { useState, useEffect, useCallback } from "react";
import "./Settings.css";

export interface GardenSettings {
  enableTilt: boolean;
  enableBloom: boolean;
  enableGrade: boolean;
  bloomStrength: number;
  tiltStrength: number;
  vignette: number;
}

const DEFAULTS: GardenSettings = {
  enableTilt: true,
  enableBloom: true,
  enableGrade: true,
  bloomStrength: 0.9,
  tiltStrength: 1.0,
  vignette: 0.5,
};

export function loadGardenSettings(): GardenSettings {
  try {
    const raw = localStorage.getItem("garden-settings");
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function saveGardenSettings(s: GardenSettings) {
  localStorage.setItem("garden-settings", JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("garden-settings-changed", { detail: s }));
}

export function Settings() {
  const [settings, setSettings] = useState<GardenSettings>(loadGardenSettings);

  const update = useCallback(
    (patch: Partial<GardenSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveGardenSettings(next);
        return next;
      });
    },
    []
  );

  const [version, setVersion] = useState("");
  useEffect(() => {
    try {
      setVersion(__APP_VERSION__ ?? "dev");
    } catch {
      setVersion("dev");
    }
  }, []);

  return (
    <div className="settings">
      <section className="settings-section">
        <h3>描画エフェクト</h3>
        <p className="settings-hint">
          箱庭の見た目を調整できるよ。重いと感じたらオフにしてみて
        </p>

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.enableBloom}
            onChange={(e) => update({ enableBloom: e.target.checked })}
          />
          <span className="toggle-label">Bloom（光のにじみ）</span>
        </label>

        {settings.enableBloom && (
          <label className="setting-slider">
            <span className="slider-label">強さ</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.bloomStrength}
              onChange={(e) => update({ bloomStrength: parseFloat(e.target.value) })}
            />
            <span className="slider-value">{settings.bloomStrength.toFixed(1)}</span>
          </label>
        )}

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.enableTilt}
            onChange={(e) => update({ enableTilt: e.target.checked })}
          />
          <span className="toggle-label">Tilt-Shift（ミニチュアぼかし）</span>
        </label>

        {settings.enableTilt && (
          <label className="setting-slider">
            <span className="slider-label">強さ</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.tiltStrength}
              onChange={(e) => update({ tiltStrength: parseFloat(e.target.value) })}
            />
            <span className="slider-value">{settings.tiltStrength.toFixed(1)}</span>
          </label>
        )}

        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={settings.enableGrade}
            onChange={(e) => update({ enableGrade: e.target.checked })}
          />
          <span className="toggle-label">色グレーディング</span>
        </label>

        <label className="setting-slider">
          <span className="slider-label">ビネット</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.vignette}
            onChange={(e) => update({ vignette: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{settings.vignette.toFixed(2)}</span>
        </label>
      </section>

      <section className="settings-section">
        <h3>アプリ情報</h3>
        <div className="settings-info">
          <div className="info-row">
            <span className="info-label">バージョン</span>
            <span className="info-value">{version}</span>
          </div>
          <div className="info-row">
            <span className="info-label">監視間隔</span>
            <span className="info-value">30秒</span>
          </div>
          <div className="info-row">
            <span className="info-label">成長レート</span>
            <span className="info-value">0.04/h（±40%個体差）</span>
          </div>
          <div className="info-row">
            <span className="info-label">シーズン周期</span>
            <span className="info-value">90日</span>
          </div>
        </div>
      </section>
    </div>
  );
}

declare const __APP_VERSION__: string | undefined;
