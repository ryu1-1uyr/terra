//! アイコン色抽出の動作確認用。
//! 使い方: cargo run --example icon_color -- <実行ファイル or .app のパス>

use std::path::Path;

fn main() {
    let arg = match std::env::args().nth(1) {
        Some(a) => a,
        None => {
            eprintln!("usage: cargo run --example icon_color -- <path>");
            std::process::exit(1);
        }
    };

    match terra_lib::ambient::dominant_color_from_exe(Path::new(&arg)) {
        Some(c) => println!(
            "dominant color: #{:02X}{:02X}{:02X}  rgb({}, {}, {})",
            c.r, c.g, c.b, c.r, c.g, c.b
        ),
        None => println!("could not extract color from: {arg}"),
    }
}
