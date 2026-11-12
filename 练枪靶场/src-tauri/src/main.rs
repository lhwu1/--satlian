#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io,
    net::{TcpStream, ToSocketAddrs},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{webview::WebviewWindowBuilder, AppHandle, Manager, RunEvent};

const BACKEND: &[u8] = include_bytes!("../../dist/range-backend.exe");

struct Service(Mutex<Option<Child>>);

fn local_backend_dir() -> io::Result<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let dir = base.join("SaltlineRange");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn launch_backend(port_file: &std::path::Path) -> Result<Child, String> {
    let path = local_backend_dir().map_err(|e| format!("无法准备靶场运行目录：{e}"))?.join(format!("range-backend-{}.exe", std::process::id()));
    fs::write(&path, BACKEND).map_err(|e| format!("无法初始化靶场组件：{e}"))?;
    let mut command = Command::new(&path);
    command.arg("--port").arg("8876").arg("--port-file").arg(port_file).arg("--desktop")
        .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command.spawn().map_err(|e| format!("本机靶场服务启动失败：{e}"))
}

fn wait_ready(child: &mut Child, port_file: &std::path::Path, timeout: Duration) -> Result<u16, String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return Err(format!("本机靶场服务已退出（{status}），请重试或检查端口 8876 是否被占用。"));
        }
        if let Some(port) = fs::read_to_string(port_file).ok().and_then(|s| s.parse::<u16>().ok()) {
            if let Some(addr) = ("127.0.0.1", port).to_socket_addrs().ok().and_then(|mut a| a.next()) {
                if TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok() { return Ok(port); }
            }
        }
        thread::sleep(Duration::from_millis(150));
    }
    Err("启动靶场服务超时。请检查端口 8876 是否被占用。".into())
}

fn stop_child(child: &mut Child) {
    drop(child.stdin.take());
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if matches!(child.try_wait(), Ok(Some(_))) { return; }
        thread::sleep(Duration::from_millis(100));
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill").args(["/PID", &child.id().to_string(), "/T", "/F"])
            .creation_flags(0x08000000).output();
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn stop_service(app: &AppHandle) {
    if let Some(state) = app.try_state::<Service>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                stop_child(&mut child);
            }
        }
    }
}

#[cfg(windows)]
fn show_error(error: &str) {
    #[link(name = "user32")]
    unsafe extern "system" { fn MessageBoxW(hwnd: isize, text: *const u16, title: *const u16, kind: u32) -> i32; }
    let message: Vec<u16> = format!("靶场启动失败：{error}\0").encode_utf16().collect();
    let title: Vec<u16> = "沿线练枪靶场\0".encode_utf16().collect();
    unsafe { MessageBoxW(0, message.as_ptr(), title.as_ptr(), 0x10); }
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let port_file = local_backend_dir()?.join(format!("port-{}", std::process::id()));
            let _ = fs::remove_file(&port_file);
            let mut child = launch_backend(&port_file).map_err(std::io::Error::other)?;
            let port = match wait_ready(&mut child, &port_file, Duration::from_secs(20)) {
                Ok(port) => port,
                Err(error) => { stop_child(&mut child); let _ = fs::remove_file(&port_file); return Err(std::io::Error::other(error).into()); }
            };
            app.manage(Service(Mutex::new(Some(child))));
            WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(
                format!("http://127.0.0.1:{port}/").parse().unwrap(),
            ))
            .title("沿线练枪靶场")
            .inner_size(1440.0, 900.0)
            .min_inner_size(960.0, 640.0)
            .center()
            .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .unwrap_or_else(|error| {
            #[cfg(windows)]
            show_error(&error.to_string());
            eprintln!("桌面端启动失败：{error}");
            std::process::exit(1);
        });
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_service(&handle);
            if let Ok(dir) = local_backend_dir() {
                let _ = fs::remove_file(dir.join(format!("range-backend-{}.exe", std::process::id())));
                let _ = fs::remove_file(dir.join(format!("port-{}", std::process::id())));
                let _ = fs::remove_dir(dir);
            }
        }
    });
}
