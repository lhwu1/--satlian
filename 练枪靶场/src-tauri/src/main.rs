#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, io, net::{TcpStream, ToSocketAddrs}, path::{Path, PathBuf}, process::{Child, Command, Stdio}, sync::Mutex, thread, time::{Duration, Instant}};
use tauri::{webview::WebviewWindowBuilder, AppHandle, Manager, RunEvent};

const BACKEND: &[u8] = include_bytes!("../../dist/range-backend.exe");
struct Services(Mutex<Vec<Child>>);

fn app_dir() -> io::Result<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
    let dir = base.join("SaltlineRange"); fs::create_dir_all(&dir)?; Ok(dir)
}
fn launch_backend(port_file: &Path) -> Result<Child, String> {
    let path = app_dir().map_err(|e| format!("无法准备运行目录：{e}"))?.join(format!("range-backend-{}.exe", std::process::id()));
    fs::write(&path, BACKEND).map_err(|e| format!("无法初始化靶场组件：{e}"))?;
    let mut c=Command::new(&path); c.args(["--port","8876","--port-file"]).arg(port_file).arg("--desktop").stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)] { use std::os::windows::process::CommandExt; c.creation_flags(0x08000000); }
    c.spawn().map_err(|e| format!("本机靶场服务启动失败：{e}"))
}
fn launch_editor() -> Result<Child,String> {
    let mut c=Command::new("node"); c.args(["编辑器/mcp-server.cjs","--serve"]);
    if let Ok(exe)=std::env::current_exe() { if let Some(dir)=exe.parent() { c.current_dir(dir); } }
    c.stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)] { use std::os::windows::process::CommandExt; c.creation_flags(0x08000000); }
    c.spawn().map_err(|e| format!("地图编辑器服务启动失败，请确认已安装 Node.js：{e}"))
}
fn wait_ready(child:&mut Child, port_file:&Path, timeout:Duration)->Result<u16,String>{
    let deadline=Instant::now()+timeout;
    while Instant::now()<deadline { if let Some(s)=child.try_wait().map_err(|e|e.to_string())? { return Err(format!("靶场服务已退出（{s}）")); }
        if let Some(p)=fs::read_to_string(port_file).ok().and_then(|s|s.parse::<u16>().ok()) { if let Some(a)=("127.0.0.1",p).to_socket_addrs().ok().and_then(|mut x|x.next()) { if TcpStream::connect_timeout(&a,Duration::from_millis(250)).is_ok(){return Ok(p)} } }
        thread::sleep(Duration::from_millis(150)); }
    Err("启动靶场服务超时".into())
}
fn stop_child(child:&mut Child){ drop(child.stdin.take()); let deadline=Instant::now()+Duration::from_secs(3); while Instant::now()<deadline { if matches!(child.try_wait(),Ok(Some(_))){return} thread::sleep(Duration::from_millis(100)); } #[cfg(windows)] { use std::os::windows::process::CommandExt; let _=Command::new("taskkill").args(["/PID",&child.id().to_string(),"/T","/F"]).creation_flags(0x08000000).output(); } let _=child.kill(); let _=child.wait(); }
fn stop_services(app:&AppHandle){ if let Some(state)=app.try_state::<Services>() { if let Ok(mut g)=state.0.lock(){ for mut c in g.drain(..){stop_child(&mut c)} } } }
#[cfg(windows)] fn show_error(e:&str){ #[link(name="user32")] unsafe extern "system"{fn MessageBoxW(hwnd:isize,text:*const u16,title:*const u16,kind:u32)->i32;} let m:Vec<u16>=format!("桌面端启动失败：{e}\0").encode_utf16().collect(); let t:Vec<u16>="沿线战术工作台\0".encode_utf16().collect(); unsafe{MessageBoxW(0,m.as_ptr(),t.as_ptr(),0x10);}; }
fn main(){ let app=tauri::Builder::default().setup(|app|{ let pf=app_dir()?.join(format!("port-{}",std::process::id())); let _=fs::remove_file(&pf); let mut backend=launch_backend(&pf).map_err(io::Error::other)?; let port=match wait_ready(&mut backend,&pf,Duration::from_secs(20)){Ok(p)=>p,Err(e)=>{stop_child(&mut backend);return Err(io::Error::other(e).into())}}; let editor=launch_editor().map_err(io::Error::other)?; app.manage(Services(Mutex::new(vec![backend,editor]))); WebviewWindowBuilder::new(app,"main",tauri::WebviewUrl::External(format!("http://127.0.0.1:{port}/").parse().unwrap())).title("沿线战术工作台").inner_size(1440.0,900.0).min_inner_size(960.0,640.0).center().build()?; Ok(()) }).build(tauri::generate_context!()).unwrap_or_else(|e|{#[cfg(windows)]show_error(&e.to_string());eprintln!("desktop startup failed: {e}");std::process::exit(1)}); app.run(|h,e|{if let RunEvent::Exit=e{stop_services(&h);if let Ok(d)=app_dir(){let _=fs::remove_file(d.join(format!("range-backend-{}.exe",std::process::id())));let _=fs::remove_file(d.join(format!("port-{}",std::process::id())));}}}); }
