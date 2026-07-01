//! アプリのアイコンから代表色を取り出す色解析。
//!
//! 「起動中のアプリ（生活）を庭の空気に反映する」機能の実色パート。
//! 実行ファイルパス → アイコン(PNG) → 代表色 の変換をここに閉じ込める。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct Rgb {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// 実行ファイルパスからアプリアイコンの代表色を取り出す。
/// アイコンが取得できない、または解析できない場合は `None`。
pub fn dominant_color_from_exe(path: &Path) -> Option<Rgb> {
    let icon_path = icon_source_path(path);
    let path_str = icon_path.to_str()?;
    // アイコンを PNG バイト列で取得（64px で十分）
    let png = systemicons::get_icon(path_str, 64).ok()?;
    dominant_color_from_png(&png)
}

/// アイコン取得に渡すべきパスへ解決する。
///
/// macOS では実行ファイルはバンドル内（`Foo.app/Contents/MacOS/Foo`）にあり、
/// その生バイナリを渡すと汎用の実行ファイルアイコンが返ってしまう。祖先を辿って
/// `.app` バンドルのパスに解決する。それ以外の OS では実行ファイルパスをそのまま使う。
fn icon_source_path(exe: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let mut cur = Some(exe);
        while let Some(p) = cur {
            if p.extension().and_then(|e| e.to_str()) == Some("app") {
                return p.to_path_buf();
            }
            cur = p.parent();
        }
    }
    exe.to_path_buf()
}

/// PNG バイト列から代表色を取り出す（コア。テストしやすいよう分離）。
fn dominant_color_from_png(png: &[u8]) -> Option<Rgb> {
    let img = image::load_from_memory(png).ok()?.to_rgba8();

    // 透明ピクセルを除外して RGB 列を作る。
    // 透明背景を色として拾うと代表色が黒に引っ張られるため。
    let mut rgb: Vec<u8> = Vec::with_capacity(img.len());
    for px in img.pixels() {
        let [r, g, b, a] = px.0;
        if a >= 128 {
            rgb.extend_from_slice(&[r, g, b]);
        }
    }
    if rgb.is_empty() {
        return None;
    }

    let palette = color_thief::get_palette(&rgb, color_thief::ColorFormat::Rgb, 10, 5).ok()?;
    let best = pick_vibrant(&palette)?;
    Some(Rgb {
        r: best.r,
        g: best.g,
        b: best.b,
    })
}

/// パレットから最も「らしい」色を選ぶ。彩度を優先しつつ、
/// 真っ黒・真っ白（無彩色）に寄りすぎないよう中庸な明度を加点する。
fn pick_vibrant(palette: &[color_thief::Color]) -> Option<color_thief::Color> {
    palette
        .iter()
        .copied()
        .max_by(|a, b| vibrancy(a).partial_cmp(&vibrancy(b)).unwrap_or(std::cmp::Ordering::Equal))
}

fn vibrancy(c: &color_thief::Color) -> f64 {
    let (r, g, b) = (c.r as f64 / 255.0, c.g as f64 / 255.0, c.b as f64 / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let sat = if max <= 0.0 { 0.0 } else { (max - min) / max };
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // 明度が 0.5 で最大、両端(0/1)で 0 になる係数
    let mid = 1.0 - (lum - 0.5).abs() * 2.0;
    sat * 0.7 + mid * 0.3
}

/// HSV の彩度（0.0〜1.0）。
fn saturation(c: &Rgb) -> f64 {
    let (r, g, b) = (c.r as f64 / 255.0, c.g as f64 / 255.0, c.b as f64 / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    if max <= 0.0 {
        0.0
    } else {
        (max - min) / max
    }
}

/// 複数の色を彩度で重み付けして 1 色に混ぜる。
/// 彩度の高い（主張の強い）色ほど強く反映され、無彩色は薄まる。
/// 全部が無彩色でも成立するよう、各色に最低限の重みを与える。
pub fn blend_saturation_weighted(colors: &[Rgb]) -> Option<Rgb> {
    if colors.is_empty() {
        return None;
    }
    let (mut wr, mut wg, mut wb, mut wsum) = (0.0f64, 0.0f64, 0.0f64, 0.0f64);
    for c in colors {
        let w = saturation(c) + 0.05;
        wr += c.r as f64 * w;
        wg += c.g as f64 * w;
        wb += c.b as f64 * w;
        wsum += w;
    }
    Some(Rgb {
        r: (wr / wsum).round() as u8,
        g: (wg / wsum).round() as u8,
        b: (wb / wsum).round() as u8,
    })
}

/// プロセス名 → 抽出済みアイコン色 のキャッシュ。
/// アイコン抽出は OS 呼び出しで重いため、プロセス名単位で結果を保持する。
#[derive(Default)]
pub struct AmbientCache {
    inner: Mutex<HashMap<String, Option<Rgb>>>,
}

impl AmbientCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// プロセス名に対応する色を返す。未計算なら exe パスから抽出してキャッシュする。
    /// 抽出できなかった場合も「None」をキャッシュして再試行を避ける。
    pub fn color_for(&self, process_name: &str, exe: Option<&Path>) -> Option<Rgb> {
        let mut map = self.inner.lock().unwrap();
        if let Some(cached) = map.get(process_name) {
            return *cached;
        }
        let color = exe.and_then(dominant_color_from_exe);
        map.insert(process_name.to_string(), color);
        color
    }
}
