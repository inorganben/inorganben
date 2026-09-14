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
    // v86's `fetch` backend gives the guest a NIC and proxies its HTTP through
    // the browser's fetch(). It is CORS-bound: only hosts that allow
    // cross-origin reads are reachable, and there is no HTTPS (guest side).
    ...(boot.net
      ? { net_device: { type: "virtio" as const, relay_url: "fetch" } }
      : {}),
    autostart: true,
  });

  // Bring the NIC up once the shell prompt appears (busybox `~%`), so the user
  // doesn't have to run udhcpc by hand. DHCP is answered internally by v86.
  let dhcpSent = false;
  let tail = "";

  emulator.add_listener("serial0-output-byte", (byte: number) => {
    const char = String.fromCharCode(byte);
    term.write(char);
    if (!boot.net || dhcpSent) return;
    tail = (tail + char).slice(-4);
    if (tail.includes("~%")) {
      dhcpSent = true;
      emulator.serial0_send("udhcpc -q\r");
    }
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
