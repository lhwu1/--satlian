"""Consent-scoped Windows Raw Input capture. Never starts on import."""
import ctypes
from ctypes import wintypes as W
import secrets
import struct
import sys
import threading


class RawMouseCapture:
    def __init__(self):
        self.token = secrets.token_urlsafe(24)
        self.lock = threading.Lock()
        self.ready = threading.Event()
        self.thread = None
        self.hwnd = None
        self.error = None
        self.running = False
        self.x = self.back = self.y = self.events = self.absolute = 0
        self.devices = set()

    def start(self):
        if sys.platform != 'win32':
            raise RuntimeError('原始计数校准需要 Windows 本机后台')
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        if not self.ready.wait(4):
            raise RuntimeError('原始输入监听启动超时')
        if self.error:
            raise RuntimeError(self.error)
        return self.snapshot()

    def snapshot(self):
        with self.lock:
            return dict(token=self.token, running=self.running, x=self.x, back=self.back,
                        y=self.y, events=self.events, devices=len(self.devices),
                        absolute=self.absolute, error=self.error, source='windows-raw-input')

    def stop(self):
        if self.hwnd and self.running:
            user32 = ctypes.WinDLL('user32', use_last_error=True)
            user32.PostMessageW.argtypes = [W.HWND, W.UINT, W.WPARAM, W.LPARAM]
            user32.PostMessageW(self.hwnd, 0x0010, 0, 0)
        if self.thread:
            self.thread.join(2)
        return self.snapshot()

    def _run(self):
        user32 = ctypes.WinDLL('user32', use_last_error=True)
        kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        LRESULT = ctypes.c_ssize_t
        WNDPROC = ctypes.WINFUNCTYPE(LRESULT, W.HWND, W.UINT, W.WPARAM, W.LPARAM)

        class WNDCLASS(ctypes.Structure):
            _fields_ = [('style', W.UINT), ('lpfnWndProc', WNDPROC), ('cbClsExtra', ctypes.c_int),
                        ('cbWndExtra', ctypes.c_int), ('hInstance', W.HINSTANCE), ('hIcon', W.HICON),
                        ('hCursor', W.HANDLE), ('hbrBackground', W.HBRUSH),
                        ('lpszMenuName', W.LPCWSTR), ('lpszClassName', W.LPCWSTR)]

        class RAWINPUTDEVICE(ctypes.Structure):
            _fields_ = [('usagePage', W.USHORT), ('usage', W.USHORT), ('flags', W.DWORD), ('target', W.HWND)]

        class HEADER(ctypes.Structure):
            _fields_ = [('type', W.DWORD), ('size', W.DWORD), ('device', W.HANDLE), ('wParam', W.WPARAM)]

        kernel32.GetModuleHandleW.argtypes = [W.LPCWSTR]
        kernel32.GetModuleHandleW.restype = W.HMODULE
        user32.DefWindowProcW.argtypes = [W.HWND, W.UINT, W.WPARAM, W.LPARAM]
        user32.DefWindowProcW.restype = LRESULT
        user32.CreateWindowExW.argtypes = [W.DWORD, W.LPCWSTR, W.LPCWSTR, W.DWORD,
                                           ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                           W.HWND, W.HMENU, W.HINSTANCE, W.LPVOID]
        user32.CreateWindowExW.restype = W.HWND
        user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASS)]
        user32.RegisterClassW.restype = W.ATOM
        user32.RegisterRawInputDevices.argtypes = [ctypes.POINTER(RAWINPUTDEVICE), W.UINT, W.UINT]
        user32.GetRawInputData.argtypes = [W.HANDLE, W.UINT, W.LPVOID, ctypes.POINTER(W.UINT), W.UINT]
        user32.GetRawInputData.restype = W.UINT
        user32.DestroyWindow.argtypes = [W.HWND]
        user32.SetTimer.argtypes = [W.HWND, ctypes.c_size_t, W.UINT, W.LPVOID]
        user32.SetTimer.restype = ctypes.c_size_t
        user32.GetMessageW.argtypes = [ctypes.POINTER(W.MSG), W.HWND, W.UINT, W.UINT]
        user32.DispatchMessageW.argtypes = [ctypes.POINTER(W.MSG)]
        user32.DispatchMessageW.restype = LRESULT
        user32.UnregisterClassW.argtypes = [W.LPCWSTR, W.HINSTANCE]
        instance = kernel32.GetModuleHandleW(None)
        name = 'RangeMouse_' + self.token

        @WNDPROC
        def proc(hwnd, msg, wp, lp):
            try:
                if msg == 0x00FF:  # WM_INPUT, collect relative motion only
                    size = W.UINT()
                    header_size = ctypes.sizeof(HEADER)
                    user32.GetRawInputData(lp, 0x10000003, None, ctypes.byref(size), header_size)
                    if size.value >= header_size + 24:
                        buf = ctypes.create_string_buffer(size.value)
                        copied = user32.GetRawInputData(lp, 0x10000003, buf, ctypes.byref(size), header_size)
                        if copied == size.value:
                            header = HEADER.from_buffer_copy(buf)
                            if header.type == 0:
                                flags = struct.unpack_from('<H', buf, header_size)[0]
                                dx, dy = struct.unpack_from('<ll', buf, header_size + 12)
                                with self.lock:
                                    if flags & 1:
                                        self.absolute += 1
                                    elif dx or dy:
                                        self.devices.add(int(header.device or 0))
                                        self.x += max(0, dx)
                                        self.back += max(0, -dx)
                                        self.y += abs(dy)
                                        self.events += 1
                elif msg in (0x0010, 0x0113):  # WM_CLOSE / 30 s timeout
                    user32.DestroyWindow(hwnd)
                    return 0
                elif msg == 0x0002:
                    user32.PostQuitMessage(0)
                    return 0
            except Exception as error:
                self.error = str(error)
            return user32.DefWindowProcW(hwnd, msg, wp, lp)

        registered = False
        try:
            wc = WNDCLASS(0, proc, 0, 0, instance, None, None, None, None, name)
            if not user32.RegisterClassW(ctypes.byref(wc)):
                raise ctypes.WinError(ctypes.get_last_error())
            registered = True
            self.hwnd = user32.CreateWindowExW(0, name, '', 0, 0, 0, 0, 0, W.HWND(-3), None, instance, None)
            if not self.hwnd:
                raise ctypes.WinError(ctypes.get_last_error())
            device = RAWINPUTDEVICE(1, 2, 0x100, self.hwnd)  # INPUTSINK, no suppression
            if not user32.RegisterRawInputDevices(ctypes.byref(device), 1, ctypes.sizeof(device)):
                raise ctypes.WinError(ctypes.get_last_error())
            if not user32.SetTimer(self.hwnd, 1, 30000, None):
                raise ctypes.WinError(ctypes.get_last_error())
            self.running = True
            self.ready.set()
            message = W.MSG()
            while True:
                result = user32.GetMessageW(ctypes.byref(message), None, 0, 0)
                if result <= 0:
                    break
                user32.TranslateMessage(ctypes.byref(message))
                user32.DispatchMessageW(ctypes.byref(message))
        except Exception as error:
            self.error = str(error)
        finally:
            self.running = False
            # Explicitly unregister capture; no listener survives calibration.
            remove = RAWINPUTDEVICE(1, 2, 1, None)
            user32.RegisterRawInputDevices(ctypes.byref(remove), 1, ctypes.sizeof(remove))
            if self.hwnd:
                user32.DestroyWindow(self.hwnd)
                self.hwnd = None
            if registered:
                user32.UnregisterClassW(name, instance)
            self.ready.set()


capture_lock = threading.Lock()
capture = None


def handle_capture(action, data):
    global capture
    with capture_lock:
        if action == 'start':
            if data.get('consent') is not True:
                raise PermissionError('需要本次原始鼠标采集授权')
            if capture and capture.running:
                raise RuntimeError('已有校准正在进行，请完成或等待 30 秒自动停止')
            capture = RawMouseCapture()
            return capture.start()
        if not capture or not secrets.compare_digest(str(data.get('token', '')), capture.token):
            raise PermissionError('无效校准会话')
        if action == 'status':
            return capture.snapshot()
        if action == 'stop':
            return capture.stop()
        raise ValueError('未知校准操作')
