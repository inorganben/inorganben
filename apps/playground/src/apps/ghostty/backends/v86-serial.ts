import type { Terminal } from "@xterm/xterm";
import v86WasmUrl from "v86/build/v86.wasm?url";
import type { Distro } from "../../linux/data/distros";
import { getBootAssets } from "../../linux/store";

export interface TerminalSession {
  dispose: () => void;
}

export interface V86SerialHandlers {
  /** Called when the guest stops or the user detaches with Ctrl+]. */
  onExit: () => void;
}

/**
 * Boot a distro and wire its serial console to the terminal. Bytes from
 * serial0 are written straight to xterm; keystrokes go back through serial0.
 * Ctrl+] detaches. v86 is imported lazily so the app shell doesn't pay for the
 * emulator until something is actually booted.
 */
export async function attachV86Serial(
  term: Terminal,
  distro: Distro,
  handlers: V86SerialHandlers,
): Promise<TerminalSession> {
  const boot = distro.boot;
  if (!boot) throw new Error(`${distro.name} is not bootable`);
  const { V86 } = await import("v86");
  const assets = await getBootAssets(distro);

  let exited = false;

  const emulator = new V86({
    wasm_path: v86WasmUrl,
    memory_size: (boot.memoryMB ?? 128) * 1024 * 1024,
    bios: { buffer: assets.bios },
    vga_bios: { buffer: assets.vgabios },
    bzimage: { buffer: assets.bzimage },
    cmdline: boot.cmdline,
    filesystem: {},
    autostart: true,
  });

  emulator.add_listener("serial0-output-byte", (byte: number) => {
    term.write(String.fromCharCode(byte));
  });

  const onData = term.onData((data) => {
    emulator.serial0_send(data);
  });

  term.attachCustomKeyEventHandler((event) => {
    if (event.type === "keydown" && event.ctrlKey && event.key === "]") {
      exit();
      return false;
    }
    return true;
  });

  function detach(): void {
    term.attachCustomKeyEventHandler(() => true);
    onData.dispose();
    void emulator.destroy().catch(() => {});
  }

  function exit(): void {
    if (exited) return;
    exited = true;
    detach();
    handlers.onExit();
  }

  emulator.add_listener("emulator-stopped", () => {
    exit();
  });

  return {
    dispose() {
      if (exited) return;
      exited = true;
      detach();
    },
  };
}
