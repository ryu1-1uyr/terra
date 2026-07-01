//! 監視対象プロセスを「活動カテゴリ」に分類する共通ロジック。
//!
//! ドロップの重み付け（Phase 1）と、庭の空気の反映（Phase 2 予定）で
//! 同じ分類を使い回すため、独立モジュールに切り出している。

/// 報酬として存在する箱庭オブジェクトの全種類。
pub const OBJECT_TYPES: [&str; 9] = [
    "house", "tree", "flower", "tower", "windmill", "shrine", "lamp", "pond", "statue",
];

/// カテゴリで寄せる対象に与える重み（他は 1.0）。
const FAVORED_WEIGHT: f64 = 1.5;
const BASE_WEIGHT: f64 = 1.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Category {
    Dev,
    Design,
    Writing,
    Communication,
    Browser,
    Media,
    Unknown,
}

impl Category {
    /// プロセス名（実行ファイル名）からカテゴリを判定する。
    /// 大文字小文字は無視し、部分一致で最初にヒットしたカテゴリを返す。
    pub fn classify(process_name: &str) -> Category {
        let n = process_name.to_lowercase();
        let matches = |keywords: &[&str]| keywords.iter().any(|k| n.contains(k));

        if matches(&[
            "code", "cursor", "iterm", "terminal", "ghostty", "warp", "alacritty", "kitty",
            "vim", "nvim", "emacs", "sublime", "xcode", "docker", "cargo", "rustrover",
            "intellij", "idea", "pycharm", "goland", "webstorm", "android studio",
        ]) {
            Category::Dev
        } else if matches(&[
            "figma", "photoshop", "illustrator", "blender", "sketch", "affinity",
            "gimp", "inkscape", "aseprite", "procreate", "lightroom", "adobe",
        ]) {
            Category::Design
        } else if matches(&[
            "notion", "obsidian", "winword", "typora", "bear", "scrivener",
            "logseq", "roam", "ulysses", "craft",
        ]) {
            Category::Writing
        } else if matches(&[
            "slack", "discord", "zoom", "teams", "mail", "outlook", "telegram",
            "messenger", "webex", "skype", "chatwork", "line",
        ]) {
            Category::Communication
        } else if matches(&[
            "chrome", "safari", "firefox", "arc", "edge", "brave", "opera", "vivaldi",
        ]) {
            Category::Browser
        } else if matches(&[
            "steam", "spotify", "vlc", "music", "iina", "netflix", "obs", "twitch",
            "epicgames", "epic games",
        ]) {
            Category::Media
        } else {
            Category::Unknown
        }
    }

    /// このカテゴリで出やすくする（重みを上げる）オブジェクト種。
    fn favored_objects(&self) -> &'static [&'static str] {
        match self {
            Category::Dev => &["tower", "lamp"],
            Category::Design => &["flower", "statue"],
            Category::Writing => &["shrine", "house"],
            Category::Communication => &["house", "lamp"],
            Category::Browser => &["tree", "pond"],
            Category::Media => &["windmill", "pond"],
            Category::Unknown => &[],
        }
    }

    /// 各オブジェクト種の抽選重みを返す（`OBJECT_TYPES` と同じ並び）。
    pub fn object_weights(&self) -> [f64; 9] {
        let favored = self.favored_objects();
        let mut weights = [BASE_WEIGHT; 9];
        for (i, obj) in OBJECT_TYPES.iter().enumerate() {
            if favored.contains(obj) {
                weights[i] = FAVORED_WEIGHT;
            }
        }
        weights
    }
}

/// 引き金になったプロセス名から、重み付き抽選で報酬オブジェクト種を選ぶ。
/// `roll` は [0.0, 1.0) の一様乱数。
pub fn weighted_reward_type(process_name: &str, roll: f64) -> String {
    let weights = Category::classify(process_name).object_weights();
    let total: f64 = weights.iter().sum();
    let mut threshold = roll.clamp(0.0, 1.0) * total;

    for (i, w) in weights.iter().enumerate() {
        threshold -= w;
        if threshold < 0.0 {
            return OBJECT_TYPES[i].to_string();
        }
    }
    // 浮動小数点の丸めで抜けた場合のフォールバック
    OBJECT_TYPES[OBJECT_TYPES.len() - 1].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_is_case_insensitive_and_matches_substring() {
        assert_eq!(Category::classify("Code.exe"), Category::Dev);
        assert_eq!(Category::classify("iTerm2"), Category::Dev);
        assert_eq!(Category::classify("Figma"), Category::Design);
        assert_eq!(Category::classify("Google Chrome"), Category::Browser);
        assert_eq!(Category::classify("Spotify"), Category::Media);
        assert_eq!(Category::classify("SomeRandomApp"), Category::Unknown);
    }

    #[test]
    fn favored_objects_get_higher_weight() {
        let weights = Category::Dev.object_weights();
        let tower_idx = OBJECT_TYPES.iter().position(|o| *o == "tower").unwrap();
        let tree_idx = OBJECT_TYPES.iter().position(|o| *o == "tree").unwrap();
        assert_eq!(weights[tower_idx], FAVORED_WEIGHT);
        assert_eq!(weights[tree_idx], BASE_WEIGHT);
    }

    #[test]
    fn unknown_category_is_uniform() {
        let weights = Category::Unknown.object_weights();
        assert!(weights.iter().all(|w| *w == BASE_WEIGHT));
    }

    #[test]
    fn roll_selects_expected_object() {
        // Dev: [house,tree,flower,tower(1.5),windmill,shrine,lamp(1.5),pond,statue]
        // 合計 = 7*1.0 + 2*1.5 = 10.0
        assert_eq!(weighted_reward_type("Code", 0.0), "house");
        // roll=0.99 は最後の statue 付近
        assert_eq!(weighted_reward_type("Code", 0.999), "statue");
    }
}
