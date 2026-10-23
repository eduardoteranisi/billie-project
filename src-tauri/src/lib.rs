use tauri::webview::NewWindowResponse;
use tauri::{Url, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      #[cfg(desktop)]
      app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

      // A janela é criada aqui, e não pelo tauri.conf.json ("create": false), porque só o builder
      // aceita os handlers: o WebView nunca sai do app nem abre janelas (links externos vão pelo opener).
      let window_config = app
        .config()
        .app
        .windows
        .first()
        .ok_or("tauri.conf.json não define nenhuma janela")?
        .clone();
      let dev_url = if cfg!(debug_assertions) { app.config().build.dev_url.clone() } else { None };
      WebviewWindowBuilder::from_config(app.handle(), &window_config)?
        .on_navigation(move |url| is_app_url(url, dev_url.as_ref()))
        .on_new_window(|_url, _features| NewWindowResponse::Deny)
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Origens do próprio app: tauri://localhost (Linux) e http(s)://tauri.localhost (Windows), mais o servidor
// do Vite em modo dev. `blob:` é liberado porque a exportação de CSV/backup baixa um link para um Blob.
fn is_app_url(url: &Url, dev_url: Option<&Url>) -> bool {
  match url.scheme() {
    "tauri" => url.host_str() == Some("localhost"),
    "http" | "https" if url.host_str() == Some("tauri.localhost") => true,
    "blob" => true,
    "about" => url.path() == "blank",
    _ => dev_url.is_some_and(|dev_url| url.origin() == dev_url.origin()),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn parse(url: &str) -> Url {
    Url::parse(url).unwrap()
  }

  #[test]
  fn allows_the_app_origins() {
    for url in [
      "tauri://localhost/index.html",
      "http://tauri.localhost/index.html",
      "https://tauri.localhost/",
      "blob:tauri://localhost/0d6c9a2e-2f1b-4c1e-9b7a-3f2a1c4d5e6f",
      "about:blank",
    ] {
      assert!(is_app_url(&parse(url), None), "{url}");
    }
  }

  #[test]
  fn blocks_external_and_lookalike_urls() {
    for url in [
      "https://github.com/eduardoteranisi/billie-project/releases/latest",
      "http://evil.example/?dados=1",
      "https://tauri.localhost.evil.example/",
      "tauri://evil",
      "file:///etc/passwd",
      "data:text/html,<script>alert(1)</script>",
      "javascript:alert(1)",
      "about:srcdoc",
      "http://localhost:5173/",
    ] {
      assert!(!is_app_url(&parse(url), None), "{url}");
    }
  }

  #[test]
  fn allows_only_the_dev_server_origin_in_dev() {
    let dev_url = parse("http://localhost:5173");

    assert!(is_app_url(&parse("http://localhost:5173/index.html"), Some(&dev_url)));
    assert!(!is_app_url(&parse("http://localhost:8080/"), Some(&dev_url)));
    assert!(!is_app_url(&parse("https://github.com/"), Some(&dev_url)));
  }
}
