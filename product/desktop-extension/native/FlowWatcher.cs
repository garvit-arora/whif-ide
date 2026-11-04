// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
// Pass-through hotkey observation and Flow-owned clipboard updates only.
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Web.Script.Serialization;

namespace Wispr {
    public sealed class FlowWatcher : Form {
        private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
        private readonly HookProc hookProc;
        private IntPtr hook;
        private readonly string ideExe, flowRoot;
        private readonly int[] keys;
        private readonly int parentPid;
        private bool chord, candidate, armed, ready;
        private DateTime candidateAt, armedAt;
        private long sequence;
        private readonly Timer timer = new Timer();
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();

        [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int id, HookProc callback, IntPtr module, uint threadId);
        [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr handle);
        [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr handle, int code, IntPtr message, IntPtr data);
        [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
        [DllImport("user32.dll")] private static extern bool AddClipboardFormatListener(IntPtr window);
        [DllImport("user32.dll")] private static extern bool RemoveClipboardFormatListener(IntPtr window);
        [DllImport("user32.dll")] private static extern IntPtr GetClipboardOwner();
        [DllImport("user32.dll")] private static extern bool OpenClipboard(IntPtr window);
        [DllImport("user32.dll")] private static extern bool CloseClipboard();
        [DllImport("user32.dll")] private static extern IntPtr GetClipboardData(uint format);
        [DllImport("kernel32.dll")] private static extern IntPtr GlobalLock(IntPtr memory);
        [DllImport("kernel32.dll")] private static extern bool GlobalUnlock(IntPtr memory);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string name);

        public static int[] ParseKeys(string hotkey) {
            string alias = hotkey.Trim().ToLowerInvariant();
            if (alias == "copilot" || alias == "copilot key" || alias == "copilot button") hotkey = "Shift+Win+F23";
            return hotkey.Split('+').Select(part => {
                string key = part.Trim().ToLowerInvariant();
                if (key == "ctrl" || key == "control") return 17;
                if (key == "win" || key == "super") return 91;
                if (key == "alt") return 18;
                if (key == "shift") return 16;
                if (key == "space") return 32;
                if (key == "capslock") return 20;
                int number;
                if (key.StartsWith("f") && int.TryParse(key.Substring(1), out number) && number >= 1 && number <= 24) return 111 + number;
                if (key.Length == 1 && char.IsLetterOrDigit(key[0])) return (int)char.ToUpperInvariant(key[0]);
                throw new ArgumentException("Unsupported Flow hotkey component: " + part);
            }).Distinct().ToArray();
        }

        public FlowWatcher(string ide, string flow, string hotkey, int parent) {
            ideExe = Path.GetFullPath(ide);
            flowRoot = Path.GetFullPath(flow).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            keys = ParseKeys(hotkey);
            if (keys.Length == 0) throw new ArgumentException("Flow hotkey is empty.");
            parentPid = parent;
            hookProc = ObserveKeys;
            IntPtr handle = Handle;
            if (!AddClipboardFormatListener(handle)) throw new InvalidOperationException("Clipboard notification registration failed.");
            hook = SetWindowsHookEx(13, hookProc, GetModuleHandle(null), 0);
            if (hook == IntPtr.Zero) throw new InvalidOperationException("Flow hotkey observation could not start.");
            timer.Interval = 25;
            timer.Tick += Tick;
            timer.Start();
            Emit(new { type = "ready" });
        }

        protected override void SetVisibleCore(bool value) { base.SetVisibleCore(false); }
        private void Emit(object value) { Console.WriteLine(json.Serialize(value)); Console.Out.Flush(); }
        private bool Down(int key) { return GetAsyncKeyState(key) < 0 || (key == 91 && GetAsyncKeyState(92) < 0); }
        private bool Matches() {
            if (!keys.All(Down)) return false;
            return new int[] { 16, 17, 18, 91 }.All(key => keys.Contains(key) || !Down(key));
        }
        private string ImagePath(IntPtr window) {
            try { uint pid; GetWindowThreadProcessId(window, out pid); return Process.GetProcessById((int)pid).MainModule.FileName; }
            catch { return ""; }
        }
        private bool IdeFocused() { return string.Equals(ImagePath(GetForegroundWindow()), ideExe, StringComparison.OrdinalIgnoreCase); }
        private bool IsFlow(string executable) {
            string name = Path.GetFileNameWithoutExtension(executable);
            return executable.StartsWith(flowRoot, StringComparison.OrdinalIgnoreCase) && (name.Equals("Wispr Flow", StringComparison.OrdinalIgnoreCase) || name.Equals("Wispr Flow Helper", StringComparison.OrdinalIgnoreCase));
        }
        private bool FlowRunning() {
            foreach (Process process in Process.GetProcessesByName("Wispr Flow")) {
                using (process) { try { if (IsFlow(process.MainModule.FileName)) return true; } catch { } }
            }
            return false;
        }
        private IntPtr ObserveKeys(int code, IntPtr message, IntPtr data) {
            // The hardware Copilot key emits a short Win+Shift+F23 macro.
            // Observe its edge directly; a quick tap can fall between polling ticks.
            if (code >= 0 && Marshal.ReadInt32(data) == 134 && keys.Length == 3 && keys.Contains(16) && keys.Contains(91) && keys.Contains(134)) {
                int kind = message.ToInt32();
                if ((kind == 0x0100 || kind == 0x0104) && Down(16) && Down(91) && !Down(17) && !Down(18) && !chord) {
                    chord = true; candidate = false;
                    CaptureHotkey();
                }
                if (kind == 0x0101 || kind == 0x0105) { chord = false; if (armed) ready = true; }
            }
            if (code >= 0 && Marshal.ReadInt32(data) == 27 && armed && IdeFocused()) {
                armed = false; Emit(new { type = "cancelled", sequence = sequence });
            }
            // Never suppress, remap, log, or emit ordinary key presses.
            return CallNextHookEx(hook, code, message, data);
        }
        private void CaptureHotkey() {
            if (IdeFocused() && FlowRunning()) {
                if (!armed) { armed = true; ready = false; armedAt = DateTime.UtcNow; sequence++; }
                Emit(new { type = "hotkey", sequence = sequence });
            }
        }
        private void Tick(object sender, EventArgs args) {
            try { using (Process parent = Process.GetProcessById(parentPid)) { if (parent.HasExited || !string.Equals(parent.MainModule.FileName, ideExe, StringComparison.OrdinalIgnoreCase)) { Close(); return; } } }
            catch { Close(); return; }
            bool match = Matches();
            if (match && !chord && !candidate) { candidate = true; candidateAt = DateTime.UtcNow; }
            if (candidate && !match) candidate = false;
            if (candidate && (DateTime.UtcNow - candidateAt).TotalMilliseconds >= 50) {
                candidate = false; chord = true;
                CaptureHotkey();
            }
            if (!match && chord) { chord = false; if (armed) ready = true; }
            if (armed && (DateTime.UtcNow - armedAt).TotalMinutes > 10) { armed = false; Emit(new { type = "expired", sequence = sequence }); }
        }
        protected override void WndProc(ref Message message) {
            if (message.Msg == 0x031D && armed && ready && IdeFocused() && IsFlow(ImagePath(GetClipboardOwner()))) {
                string text = null;
                if (OpenClipboard(Handle)) {
                    try {
                        IntPtr memory = GetClipboardData(13);
                        if (memory != IntPtr.Zero) {
                            IntPtr pointer = GlobalLock(memory);
                            if (pointer != IntPtr.Zero) { try { text = Marshal.PtrToStringUni(pointer); } finally { GlobalUnlock(memory); } }
                        }
                    } finally { CloseClipboard(); }
                }
                if (!string.IsNullOrWhiteSpace(text)) {
                    armed = false;
                    if (text.Length <= 100000) Emit(new { type = "transcript", sequence = sequence, text = text });
                    else Emit(new { type = "error", message = "Flow transcript exceeds 100,000 characters. Paste it manually." });
                }
            }
            base.WndProc(ref message);
        }
        protected override void Dispose(bool disposing) {
            timer.Stop(); timer.Dispose();
            RemoveClipboardFormatListener(Handle);
            if (hook != IntPtr.Zero) { UnhookWindowsHookEx(hook); hook = IntPtr.Zero; }
            base.Dispose(disposing);
        }
        public static void Run(string ide, string flow, string hotkey, int parent) {
            Application.Run(new FlowWatcher(ide, flow, hotkey, parent));
        }
    }
}
