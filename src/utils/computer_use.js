import { mouse, keyboard, Button, Key, Point, clipboard } from '@nut-tree-fork/nut-js';
import { gridToNativeCoordinates } from './screen_grid.js';

// Configure default mouse speed for smooth/reliable automation
mouse.config.autoDelayMs = 50;
keyboard.config.autoDelayMs = 50;

/**
 * Releases all modifier keys to prevent sticky keys (Ctrl, Alt, Shift, Meta/Cmd).
 */
async function releaseAllModifiers() {
    try {
        await keyboard.releaseKey(
            Key.LeftControl, Key.RightControl,
            Key.LeftAlt, Key.RightAlt,
            Key.LeftShift, Key.RightShift,
            Key.LeftSuper, Key.RightSuper
        );
    } catch (e) {}
}

/**
 * Executes a mouse action given either a grid code (e.g. "G2", "H10") or explicit coordinates.
 */
export async function executeMouseAction(action, target, options = {}) {
    const coords = await gridToNativeCoordinates(target);
    if (!coords && (action === 'move' || action === 'click' || action === 'drag')) {
        return `ERROR: Invalid target location specified: ${JSON.stringify(target)}`;
    }

    try {
        switch (action.toLowerCase()) {
            case 'move': {
                await mouse.setPosition(new Point(coords.x, coords.y));
                return `SUCCESS: Moved mouse to grid target ${typeof target === 'string' ? target : `(${coords.x}, ${coords.y})`}`;
            }
            case 'click': {
                await mouse.setPosition(new Point(coords.x, coords.y));
                const buttonType = options.button === 'right' ? Button.RIGHT : (options.button === 'middle' ? Button.MIDDLE : Button.LEFT);
                if (options.clickType === 'double') {
                    await mouse.doubleClick(buttonType);
                } else {
                    await mouse.click(buttonType);
                }
                return `SUCCESS: ${options.clickType || 'Single'} clicked ${options.button || 'left'} button at ${typeof target === 'string' ? target : `(${coords.x}, ${coords.y})`}`;
            }
            case 'drag': {
                const fromCoords = await gridToNativeCoordinates(options.from || target);
                const toCoords = await gridToNativeCoordinates(options.to);
                if (!fromCoords || !toCoords) {
                    return `ERROR: Drag requires valid "from" and "to" target coordinates/grid codes.`;
                }
                await mouse.setPosition(new Point(fromCoords.x, fromCoords.y));
                await mouse.pressButton(Button.LEFT);
                await mouse.setPosition(new Point(toCoords.x, toCoords.y));
                await mouse.releaseButton(Button.LEFT);
                return `SUCCESS: Dragged mouse from (${fromCoords.x}, ${fromCoords.y}) to (${toCoords.x}, ${toCoords.y})`;
            }
            case 'scroll': {
                const targetPoint = coords || await gridToNativeCoordinates({ x: 640, y: 360 });
                if (targetPoint) {
                    await mouse.setPosition(new Point(targetPoint.x, targetPoint.y));
                    // Small delay to let the OS recognize the hovered window/sub-element
                    await new Promise(r => setTimeout(r, 60));
                }
                
                let rawAmount = parseInt(options.amount, 10);
                if (isNaN(rawAmount) || rawAmount <= 0) rawAmount = 5;
                
                // Nut-js on Windows SendInput expects WHEEL_DELTA units (120 per notch) or integer steps.
                // Sending in a sequential loop guarantees Chromium / Windows window messages process each notch.
                const count = rawAmount > 50 ? Math.min(20, Math.max(1, Math.round(rawAmount / 100))) : Math.min(20, rawAmount);
                const isUp = options.direction === 'up';

                for (let i = 0; i < count; i++) {
                    if (isUp) {
                        await mouse.scrollUp(120);
                    } else {
                        await mouse.scrollDown(120);
                    }
                    await new Promise(r => setTimeout(r, 20));
                }

                return `SUCCESS: Scrolled ${options.direction || 'down'} (${count} notches${coords ? ` at target (${coords.x}, ${coords.y})` : ' at screen center'})`;
            }
            default:
                return `ERROR: Unsupported mouse action "${action}"`;
        }
    } catch (err) {
        return `ERROR: Mouse action failed: ${err.message}`;
    }
}

/**
 * Key map helper for standard keyboard keys.
 */
const KEY_MAP = {
    'enter': Key.Enter,
    'return': Key.Return,
    'escape': Key.Escape,
    'esc': Key.Escape,
    'backspace': Key.Backspace,
    'tab': Key.Tab,
    'space': Key.Space,
    'up': Key.Up,
    'down': Key.Down,
    'left': Key.Left,
    'right': Key.Right,
    'ctrl': Key.LeftControl,
    'control': Key.LeftControl,
    'alt': Key.LeftAlt,
    'shift': Key.LeftShift,
    'cmd': Key.LeftCmd,
    'win': Key.LeftWin,
    'meta': Key.LeftWin,
    'super': Key.LeftSuper,
    'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E, 'f': Key.F, 'g': Key.G,
    'h': Key.H, 'i': Key.I, 'j': Key.J, 'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N,
    'o': Key.O, 'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T, 'u': Key.U,
    'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y, 'z': Key.Z,
    '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3, '4': Key.Num4,
    '5': Key.Num5, '6': Key.Num6, '7': Key.Num7, '8': Key.Num8, '9': Key.Num9,
    'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4, 'f5': Key.F5, 'f6': Key.F6,
    'f7': Key.F7, 'f8': Key.F8, 'f9': Key.F9, 'f10': Key.F10, 'f11': Key.F11, 'f12': Key.F12
};

const resolveKey = (keyName) => {
    if (!keyName) return undefined;
    const lower = String(keyName).toLowerCase().trim();
    if (KEY_MAP[lower] !== undefined) return KEY_MAP[lower];
    if (Key[keyName] !== undefined) return Key[keyName];
    if (Key[lower.toUpperCase()] !== undefined) return Key[lower.toUpperCase()];
    return undefined;
};

/**
 * Executes a keyboard action (type text, press single key, key combination).
 */
export async function executeKeyboardAction(action, input, options = {}) {
    try {
        switch (action.toLowerCase()) {
            case 'type': {
                if (typeof input !== 'string') return `ERROR: Type action requires a valid string input`;
                
                // 1. Ensure no modifier keys (Ctrl/Alt/Shift) are stuck down
                await releaseAllModifiers();

                // 2. Set text to clipboard and paste instantly
                await clipboard.setContent(input);
                const isMac = process.platform === 'darwin';
                const pasteMod = isMac ? Key.LeftSuper : Key.LeftControl;
                
                await keyboard.pressKey(pasteMod, Key.V);
                await keyboard.releaseKey(pasteMod, Key.V);
                await releaseAllModifiers();

                if (options.autoPressEnter) {
                    await new Promise(r => setTimeout(r, 50));
                    await keyboard.type(Key.Enter);
                    return `SUCCESS: Typed text input ("${input.length > 20 ? input.substring(0, 20) + '...' : input}") and pressed Enter`;
                }
                return `SUCCESS: Typed text input ("${input.length > 20 ? input.substring(0, 20) + '...' : input}")`;
            }
            case 'key_press': {
                const mappedKey = resolveKey(input);
                if (mappedKey === undefined) return `ERROR: Unknown key name "${input}"`;
                await keyboard.type(mappedKey);
                return `SUCCESS: Pressed key ${input}`;
            }
            case 'key_combination': {
                if (!Array.isArray(input)) return `ERROR: key_combination requires an array of keys (e.g. ["ctrl", "c"])`;
                const mappedKeys = input.map(k => resolveKey(k)).filter(k => k !== undefined);
                if (mappedKeys.length === 0) return `ERROR: Invalid key combination`;
                await keyboard.pressKey(...mappedKeys);
                await keyboard.releaseKey(...mappedKeys);
                return `SUCCESS: Executed key combination [${input.join(' + ')}]`;
            }
            case 'clear_input': {
                await keyboard.pressKey(Key.LeftControl, Key.A);
                await keyboard.releaseKey(Key.LeftControl, Key.A);
                await keyboard.type(Key.Backspace);
                return `SUCCESS: Cleared active text input (Select All + Backspace)`;
            }
            default:
                return `ERROR: Unsupported keyboard action "${action}"`;
        }
    } catch (err) {
        return `ERROR: Keyboard action failed: ${err.message}`;
    }
}
