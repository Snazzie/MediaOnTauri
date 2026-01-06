use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    import_js_scripts_to_rust();

    // Run the Tauri build process
    tauri_build::build();
}

/// Imports JavaScript file contents to Rust string constants
///
/// This function handles the entire process of:
/// 1. Locating the JavaScript files
/// 2. Reading their contents
/// 3. Generating Rust code with the JS content as string constants
/// 4. Writing the generated code to the output file
///
/// # Returns
///
/// The path to the generated Rust file
fn import_js_scripts_to_rust() -> PathBuf {
    // Get the output directory for generated files
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("js_scripts.rs");

    // Get the manifest directory (where Cargo.toml is located)
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let js_dir = Path::new(&manifest_dir)
        .join("src")
        .join("scripts")
        .join("js");

    // Define the scripts to compile
    let scripts = [
        ("FULLSCREEN_SCRIPT", "fullscreen_script.js"),
        ("PIP_SCRIPT", "pip_script.js"),
        ("ZOOM_SCRIPT", "zoom_script.js"),
        ("BRIGHTNESS_SCRIPT", "brightness_script.js"),
        ("PIP_CONTROLS_SCRIPT", "pip_controls_script.js"),
        ("VIDEO_ENHANCE_SCRIPT", "video_enhance_script.js"),
    ];

    // Generate Rust code for each script
    let mut rust_code = String::new();

    for (const_name, js_filename) in scripts.iter() {
        // Create the full path to the JS file
        let js_path: PathBuf = js_dir.join(js_filename);

        // Read the JS file content
        let js_content = fs::read_to_string(&js_path)
            .unwrap_or_else(|_| panic!("Failed to read JS file: {}", js_path.display()));

        // Add the constant definition to the Rust code
        rust_code.push_str(&format!(
            "pub const {}: &str = r#\"\n{}\n\"#;\n\n",
            const_name, js_content
        ));

        // Tell Cargo to rerun the build script if this JS file changes
        println!("cargo:rerun-if-changed={}", js_path.display());
    }

    // Write the generated Rust code to the output file
    fs::write(&dest_path, rust_code).expect("Failed to write generated Rust code");

    // Return the path to the generated file
    dest_path
}
