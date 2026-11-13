from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, json, socket, urllib.request, webbrowser, sys, math, threading
ROOT=(Path(getattr(sys, '_MEIPASS', Path(sys.executable).resolve().parent))
      if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent)
MODEL='/mnt/data_diskd/Projects/llm_related/Qwen/Qwen3-VL-8B-Instruct'
UPSTREAM='http://192.168.0.205:8002/v1/chat/completions'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if self.path == '/api/health': return self._json(200, {'ok': True, 'service': 'range'})
        if self.path in ('/', '/desktop'):
            self.path = '/unified.html'
        return super().do_GET()
    def do_POST(self):
        if self.path == '/api/health':
            return self._json(200, {'ok': True, 'service': 'range'})
        if self.path.startswith('/api/mouse-calibration/'):
            expected={f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'}
            if self.headers.get('Origin') not in expected:
                return self._json(403,{'error':'仅允许本机靶场授权采集'})
            try:
                from raw_mouse import handle_capture
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=4096: raise ValueError('无效请求')
                data=json.loads(self.rfile.read(length))
                return self._json(200,handle_capture(self.path.rsplit('/',1)[-1],data))
            except PermissionError as error:
                return self._json(403,{'error':str(error)})
            except Exception as error:
                return self._json(400,{'error':str(error)})
        if self.path=='/api/mouse-settings':
            expected={f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'}
            if self.headers.get('Origin') not in expected:
                return self._json(403,{'error':'只允许靶场本机页面在明确同意后读取'})
            try:
                data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
                if data.get('consent') is not True:
                    return self._json(403,{'error':'尚未同意读取本机设置'})
                return self._json(200,read_mouse_settings())
            except Exception as e:
                return self._json(500,{'error':str(e)})
        if self.path!='/api/analyze': return self.send_error(404)
        try:
            data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
            if data.get('shots',0)<5 or len(data.get('trajectory',[]))<10:
                return self._json(200,{'multiplier':1,'reason':'本轮有效射击或轨迹样本不足，保持灵敏度，完成更多有效命中后再比较。','improvements':['下一轮至少完成 5 次射击，保持相同 DPI 和靶型。']})
            prompt=('根据以下 FPS 练枪统计返回 JSON：{"multiplier":0.9到1.1之间的数字,"reason":"引用本轮指标的中文调整原因","improvements":["最多三条具体改进建议"]}。'
                    'multiplier 调整页面 DPI 倍率，页面视角速度同步按比例变化；不能调整硬件 DPI 或系统桌面速度。dpi 是固定硬件基准，pageDpi 是可调页面等效 DPI。dpiSource=estimated 表示距离校准估算，manual 表示用户手填，均未经厂商驱动验证。'
                    'hitIntervals 是连续命中间隔，不是严格反应时；directionChanges 也不能单独证明过冲。轨迹是聚合鼠标输入，不能据此声称找到唯一最佳灵敏度。'
                    '只根据可观察的数据给出小幅试验建议，信息不足时 multiplier=1，不要编造统计。统计：'+json.dumps(data,ensure_ascii=False))
            body=json.dumps({'model':MODEL,'temperature':0.2,'max_tokens':700,'messages':[{'role':'system','content':'你是 FPS 鼠标灵敏度教练，只返回 JSON。'},{'role':'user','content':prompt}]}).encode()
            req=urllib.request.Request(UPSTREAM,data=body,headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=45) as res: out=json.loads(res.read())
            text=out.get('choices',[{}])[0].get('message',{}).get('content',''); start=text.find('{'); end=text.rfind('}')+1
            if start<0 or end<=start: raise ValueError('模型未返回有效 JSON')
            result=json.loads(text[start:end])
            factor=float(result.get('multiplier',1))
            if not math.isfinite(factor): raise ValueError('模型返回无效调整幅度')
            result={'multiplier':max(.9,min(1.1,factor)),
                    'reason':str(result.get('reason') or '模型未提供充分调整原因，本轮保持原设置。')[:1000],
                    'improvements':[str(x)[:300] for x in result.get('improvements',[])[:3]] if isinstance(result.get('improvements',[]),list) else []}
            if not json.loads(text[start:end]).get('reason'): result['multiplier']=1
            self._json(200,result)
        except Exception as e: self._json(502,{'error':str(e)})
    def _json(self,code,data):
        raw=json.dumps(data,ensure_ascii=False).encode(); self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
class RangeServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

def read_mouse_settings():
    result={'hardwareDpi':None,'hardwareDpiStatus':'Windows 无通用硬件 DPI 查询接口，请手填驱动数值或按实际距离估算。','platform':sys.platform}
    if sys.platform!='win32':
        result['note']='当前后台不是 Windows，不能读取 Windows 指针设置。'
        return result
    import ctypes
    user32=ctypes.windll.user32
    speed=ctypes.c_int()
    mouse=(ctypes.c_int*3)()
    if not user32.SystemParametersInfoW(0x0070,0,ctypes.byref(speed),0): raise ctypes.WinError()
    if not user32.SystemParametersInfoW(0x0003,0,mouse,0): raise ctypes.WinError()
    result.update(pointerSpeed=speed.value,acceleration=bool(mouse[2]),thresholds=[mouse[0],mouse[1]])
    return result

def create_server(port=8876):
    # 靶场固定使用 8876，避开常被其他本地静态服务占用的 8765。
    try:
        return RangeServer(('127.0.0.1', port), Handler)
    except OSError as error:
        if error.errno in (98, 10048, 10013):
            raise RuntimeError(f'靶场端口 {port} 已被占用。请关闭旧靶场窗口后重试。') from error
        raise

def main():
    parser = argparse.ArgumentParser(description='本地练枪靶场服务')
    parser.add_argument('--port', type=int, default=8876)
    parser.add_argument('--open', action='store_true', dest='open_browser')
    parser.add_argument('--port-file', type=Path)
    parser.add_argument('--desktop', action='store_true')
    args = parser.parse_args()
    server = create_server(args.port)
    url = f'http://127.0.0.1:{server.server_port}/'
    if args.port_file:
        args.port_file.write_text(str(server.server_port), encoding='ascii')
    print(f'靶场已启动：{url}', flush=True)
    if args.open_browser:
        webbrowser.open(url)
    if args.desktop:
        def wait_for_window_close():
            sys.stdin.buffer.read(1)
            server.shutdown()
        threading.Thread(target=wait_for_window_close, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if args.port_file:
            args.port_file.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
