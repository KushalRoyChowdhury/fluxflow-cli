import { parseArgs } from '../utils/arg_parser.js';
import { captureGriddedScreenshot } from '../utils/screen_grid.js';

/**
 * RecaptureScreen Tool for GUI Automation
 * Triggers a screen recapture for fresh gridded vision feedback without moving hardware cursor.
 * @param {string|Object} args - Arguments containing optional canvasMode (boolean, default: false).
 */
export const recapture_screen = async (args, context = {}) => {
    const parsed = typeof args === 'string' ? parseArgs(args) : (args || {});
    const canvasMode = parsed.canvasMode === true || parsed.canvasMode === 'true' || parsed.canvas_mode === true || parsed.canvas_mode === 'true';

    try {
        const screenshotData = await captureGriddedScreenshot({ canvasMode });
        if (screenshotData && screenshotData.base64) {
            const modeText = canvasMode ? ' (static canvas grid mode)' : '';
            return {
                text: `Screen recaptured${modeText}.`,
                binaryPart: {
                    inlineData: {
                        mimeType: screenshotData.mimeType,
                        data: screenshotData.base64
                    }
                }
            };
        }
    } catch (e) {
        // Fallback to text acknowledgement if capture failed
    }

    return 'Screen recaptured.';
};
