import { Graphics } from "pixi.js";

/**
 * Parses an SVG path `d` attribute string and draws it onto a PixiJS Graphics object.
 * Supports: M, L, H, V, C, S, Q, T, Z (both absolute and relative).
 */

interface PathCursor {
  x: number;
  y: number;
  startX: number;
  startY: number;
  lastCx: number;
  lastCy: number;
}

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /([MmLlHhVvCcSsQqTtZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function nextNum(tokens: string[], index: { i: number }): number {
  return parseFloat(tokens[index.i++]);
}

export function drawSvgPath(g: Graphics, d: string, offsetX = 0, offsetY = 0, scale = 1): void {
  const tokens = tokenize(d);
  const idx = { i: 0 };
  const cur: PathCursor = { x: 0, y: 0, startX: 0, startY: 0, lastCx: 0, lastCy: 0 };
  let lastCmd = "";

  const tx = (x: number): number => offsetX + x * scale;
  const ty = (y: number): number => offsetY + y * scale;

  while (idx.i < tokens.length) {
    let cmd = tokens[idx.i];

    if (/^[MmLlHhVvCcSsQqTtZz]$/.test(cmd)) {
      idx.i++;
    } else {
      // Implicit repeat of last command (except M becomes L)
      cmd = lastCmd === "M" ? "L" : lastCmd === "m" ? "l" : lastCmd;
    }

    switch (cmd) {
      case "M":
        cur.x = nextNum(tokens, idx);
        cur.y = nextNum(tokens, idx);
        cur.startX = cur.x;
        cur.startY = cur.y;
        g.moveTo(tx(cur.x), ty(cur.y));
        break;

      case "m":
        cur.x += nextNum(tokens, idx);
        cur.y += nextNum(tokens, idx);
        cur.startX = cur.x;
        cur.startY = cur.y;
        g.moveTo(tx(cur.x), ty(cur.y));
        break;

      case "L":
        cur.x = nextNum(tokens, idx);
        cur.y = nextNum(tokens, idx);
        g.lineTo(tx(cur.x), ty(cur.y));
        break;

      case "l":
        cur.x += nextNum(tokens, idx);
        cur.y += nextNum(tokens, idx);
        g.lineTo(tx(cur.x), ty(cur.y));
        break;

      case "H":
        cur.x = nextNum(tokens, idx);
        g.lineTo(tx(cur.x), ty(cur.y));
        break;

      case "h":
        cur.x += nextNum(tokens, idx);
        g.lineTo(tx(cur.x), ty(cur.y));
        break;

      case "V":
        cur.y = nextNum(tokens, idx);
        g.lineTo(tx(cur.x), ty(cur.y));
        break;

      case "v":
        cur.y += nextNum(tokens, idx);
        g.lineTo(tx(cur.x), ty(cur.y));
        break;

      case "C": {
        const c1x = nextNum(tokens, idx);
        const c1y = nextNum(tokens, idx);
        const c2x = nextNum(tokens, idx);
        const c2y = nextNum(tokens, idx);
        cur.x = nextNum(tokens, idx);
        cur.y = nextNum(tokens, idx);
        cur.lastCx = c2x;
        cur.lastCy = c2y;
        g.bezierCurveTo(tx(c1x), ty(c1y), tx(c2x), ty(c2y), tx(cur.x), ty(cur.y));
        break;
      }

      case "c": {
        const c1x = cur.x + nextNum(tokens, idx);
        const c1y = cur.y + nextNum(tokens, idx);
        const c2x = cur.x + nextNum(tokens, idx);
        const c2y = cur.y + nextNum(tokens, idx);
        cur.x += nextNum(tokens, idx);
        cur.y += nextNum(tokens, idx);
        cur.lastCx = c2x;
        cur.lastCy = c2y;
        g.bezierCurveTo(tx(c1x), ty(c1y), tx(c2x), ty(c2y), tx(cur.x), ty(cur.y));
        break;
      }

      case "S": {
        const rx = 2 * cur.x - cur.lastCx;
        const ry = 2 * cur.y - cur.lastCy;
        const c2x = nextNum(tokens, idx);
        const c2y = nextNum(tokens, idx);
        cur.x = nextNum(tokens, idx);
        cur.y = nextNum(tokens, idx);
        cur.lastCx = c2x;
        cur.lastCy = c2y;
        g.bezierCurveTo(tx(rx), ty(ry), tx(c2x), ty(c2y), tx(cur.x), ty(cur.y));
        break;
      }

      case "s": {
        const rx = 2 * cur.x - cur.lastCx;
        const ry = 2 * cur.y - cur.lastCy;
        const c2x = cur.x + nextNum(tokens, idx);
        const c2y = cur.y + nextNum(tokens, idx);
        cur.x += nextNum(tokens, idx);
        cur.y += nextNum(tokens, idx);
        cur.lastCx = c2x;
        cur.lastCy = c2y;
        g.bezierCurveTo(tx(rx), ty(ry), tx(c2x), ty(c2y), tx(cur.x), ty(cur.y));
        break;
      }

      case "Q": {
        const cx = nextNum(tokens, idx);
        const cy = nextNum(tokens, idx);
        cur.x = nextNum(tokens, idx);
        cur.y = nextNum(tokens, idx);
        cur.lastCx = cx;
        cur.lastCy = cy;
        g.quadraticCurveTo(tx(cx), ty(cy), tx(cur.x), ty(cur.y));
        break;
      }

      case "q": {
        const cx = cur.x + nextNum(tokens, idx);
        const cy = cur.y + nextNum(tokens, idx);
        cur.x += nextNum(tokens, idx);
        cur.y += nextNum(tokens, idx);
        cur.lastCx = cx;
        cur.lastCy = cy;
        g.quadraticCurveTo(tx(cx), ty(cy), tx(cur.x), ty(cur.y));
        break;
      }

      case "T": {
        const cx = 2 * cur.x - cur.lastCx;
        const cy = 2 * cur.y - cur.lastCy;
        cur.x = nextNum(tokens, idx);
        cur.y = nextNum(tokens, idx);
        cur.lastCx = cx;
        cur.lastCy = cy;
        g.quadraticCurveTo(tx(cx), ty(cy), tx(cur.x), ty(cur.y));
        break;
      }

      case "t": {
        const cx = 2 * cur.x - cur.lastCx;
        const cy = 2 * cur.y - cur.lastCy;
        cur.x += nextNum(tokens, idx);
        cur.y += nextNum(tokens, idx);
        cur.lastCx = cx;
        cur.lastCy = cy;
        g.quadraticCurveTo(tx(cx), ty(cy), tx(cur.x), ty(cur.y));
        break;
      }

      case "Z":
      case "z":
        cur.x = cur.startX;
        cur.y = cur.startY;
        g.closePath();
        break;

      default:
        break;
    }

    lastCmd = cmd;
  }
}
