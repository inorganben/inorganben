// The curated "推荐" shelf, plus the boot recipes for the ones that run in the
// terminal today. Image files live on the v86 image host (i.copy.sh); we only
// download them on demand and cache the bytes locally.
//
// Terminal boot (serial console -> Ghostty's xterm) currently works for the
// bzImage buildroot builds: their kernel console is ttyS0 and busybox gives a
// `~%` prompt. Everything else (9p rootfs, disk images) prints to the VGA
// screen and waits for the VGA renderer, so it sits here as `pending`.

export interface BootConfig {
  /** File name on the image host. */
  image: string;
  /** Exact byte length, so the progress bar has a total before headers land. */
  bytes: number;
  cmdline: string;
  memoryMB?: number;
}

export interface Distro {
  id: string;
  name: string;
  tagline: string;
  size: string;
  /** Monogram tile color. */
  color: string;
  intro: string;
  /** Upstream catalog note, when there is one. */
  note?: string;
  /** Present when this distro boots in the terminal today. */
  boot?: BootConfig;
  /** Why it can't boot in the terminal yet (shown instead of a download). */
  pending?: string;
}

const BUILDROOT_CMDLINE = "tsc=reliable mitigations=off random.trust_cpu=on";

export const DISTROS: readonly Distro[] = [
  {
    id: "buildroot6",
    name: "Buildroot Linux 6.8",
    tagline: "最小 Linux，串口 shell",
    size: "9.6 MB",
    color: "#4f8a6d",
    intro:
      "Buildroot 打包的最小 Linux，内核 6.8，自带 busybox，启动后进入 ~% 串口 shell。v86 官方串口示例用的就是它。",
    boot: {
      image: "buildroot-bzimage68.bin",
      bytes: 10068480,
      cmdline: BUILDROOT_CMDLINE,
    },
  },
  {
    id: "buildroot",
    name: "Buildroot Linux",
    tagline: "4.9 MB 的极简系统",
    size: "4.9 MB",
    color: "#4f8a6d",
    intro: "5.6 内核的极简构建，整个系统 4.9 MB，同样是 busybox 串口 shell。",
    note: "Minimal Linux with Lua, ping, curl, telnet",
    boot: {
      image: "buildroot-bzimage.bin",
      bytes: 5166352,
      cmdline: BUILDROOT_CMDLINE,
    },
  },
  {
    id: "archlinux",
    name: "Arch Linux",
    tagline: "完整滚动发行版",
    size: "15+ MB",
    color: "#1793d1",
    intro: "完整的 Arch，使用 9p 在线根文件系统，仓库含 Xorg、Firefox 等包。",
    note: "Various packages, including Xorg, Firefox and more",
    pending: "Arch 用 9p 在线根文件系统，需要 VGA 渲染器，排在下一阶段。",
  },
  {
    id: "nodeos",
    name: "NodeOS",
    tagline: "node 作为 init",
    size: "14 MB",
    color: "#68a063",
    intro: "以 Node.js 作为 /bin/init 的 Linux。串口只输出日志，控制台在 VGA。",
    note: "Linux with nodejs as /bin/init",
    pending: "NodeOS 的控制台在 VGA，串口只出不进，排在下一阶段。",
  },
  {
    id: "elks",
    name: "ELKS",
    tagline: "8086 上的 Unix 克隆",
    size: "1.2 MB",
    color: "#8a6a4f",
    intro: "可在 16 位 8086 上运行的 Unix 克隆，磁盘镜像。",
    note: "Linux for 8086",
    pending: "ELKS 是磁盘镜像，跑 VGA 文本控制台，排在下一阶段。",
  },
  {
    id: "tilck",
    name: "Tilck",
    tagline: "教学用迷你内核",
    size: "16 MB",
    color: "#7a5fb0",
    intro: "面向教学的 Linux 兼容内核，磁盘镜像。",
    note: "Tiny Linux-Compatible Kernel",
    pending: "Tilck 是磁盘镜像，跑 VGA 文本控制台，排在下一阶段。",
  },
];

export function findDistro(id: string): Distro | undefined {
  return DISTROS.find((d) => d.id === id);
}

export const ABOUT: readonly string[] = [
  "这里是 v86 的镜像陈列，可以下载并启动这些系统。",
  "下载在本应用里完成，启动入口在 Ghostty：linux boot <id>。",
];
