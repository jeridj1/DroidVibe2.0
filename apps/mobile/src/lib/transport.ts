/**
 * USB transport facade. Uses the native USB module when available (custom dev/
 * production build); otherwise falls back to a mock that never fabricates
 * hardware success (per the no-fake-success directive).
 *
 * ENHANCED for DroidVibe 2.0:
 * - Protocol auto-detection from VID/PID
 * - Auto-permission request in upload flow
 * - Board identification and search
 * - Rescan functionality
 */
import { getNativeUsbModule, type DroidVibeUsbModuleType } from '@droidvibe/native-usb';
import type {
  UsbDevice,
  SerialOptions,
  UploadRequest,
  UploadProgress,
  UploadResult,
  CaptureConfig,
  CaptureResult,
  HelperFirmwareRequest,
  SwdTransferRequest,
  JtagTransferRequest,
  RP2040Mode,
} from '@droidvibe/shared';

const native: DroidVibeUsbModuleType | null = getNativeUsbModule();

export const isNativeUsbAvailable = (): boolean => native !== null;

// ---- Device enumeration ----

export async function listDevices(): Promise<UsbDevice[]> {
  if (native) return native.listDevices();
  return [];
}

/**
 * Rescan USB bus for devices
 * Useful when user plugs in a new device after app startup
 */
export async function rescanDevices(): Promise<UsbDevice[]> {
  if (native) return native.rescanDevices();
  return [];
}

export async function requestPermission(deviceId: string): Promise<boolean> {
  if (native) return native.requestPermission(deviceId);
  return false;
}

export function addDeviceListener(cb: (e: { type: 'attach' | 'detach'; device: UsbDevice }) => void): () => void {
  if (native) return native.addDeviceListener(cb);
  return () => {};
}

// ---- Serial ----

export async function openSerial(deviceId: string, options: SerialOptions): Promise<boolean> {
  if (native) return native.openSerial(deviceId, options);
  throw new Error('Native USB unavailable (Expo Go). Use a DroidVibe dev/production build.');
}

export async function writeSerial(deviceId: string, data: Uint8Array): Promise<number> {
  if (native) return native.writeSerial(deviceId, data);
  throw new Error('Native USB unavailable');
}

export function addSerialDataListener(deviceId: string, cb: (data: Uint8Array) => void): () => void {
  if (native) return native.addSerialDataListener(deviceId, cb);
  return () => {};
}

export async function closeSerial(deviceId: string): Promise<boolean> {
  if (native) return native.closeSerial(deviceId);
  return false;
}

// ---- Upload with auto-protocol detection ----

/**
 * Upload firmware to device
 * ENHANCED: If protocol is empty, it will be auto-detected from VID/PID
 * Also auto-requests USB permission if not granted
 */
export async function upload(
  request: UploadRequest,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadResult> {
  if (native) {
    // ENHANCED: Auto-detect protocol if not specified
    const uploadRequest = {
      ...request,
      // If protocol is empty or 'unknown', let native module auto-detect
      protocol: request.protocol || ''
    };
    return native.upload(uploadRequest, onProgress);
  }
  return { ok: false, stage: 'failed', verified: false, message: 'Native USB unavailable (Expo Go).' };
}

/**
 * Get the detected protocol for a device based on VID/PID
 * Uses the board database to determine the best protocol
 */
export async function getDeviceProtocol(deviceId: string): Promise<{
  deviceId: string;
  protocol: string;
  vendorId: string;
  productId: string;
}> {
  if (native) return native.getDeviceProtocol(deviceId);
  return { deviceId, protocol: 'unknown', vendorId: '0000', productId: '0000' };
}

/** Flash an RP2040 in BOOTSEL via PICOBOOT. */
export async function flashUf2(
  deviceId: string,
  uf2Base64: string,
  verify: boolean,
): Promise<UploadResult> {
  if (native) return native.flashUf2(deviceId, uf2Base64, verify);
  return { ok: false, stage: 'failed', verified: false, message: 'Native USB unavailable (Expo Go).' };
}

export async function capture(config: CaptureConfig): Promise<CaptureResult> {
  if (native) return native.capture(config);
  throw new Error('Capture requires native USB + verified RP2040 helper firmware.');
}

// ---- RP2040 multi-mode functions ----

/** Flash helper firmware onto an RP2040 in BOOTSEL mode. */
export async function flashHelperFirmware(
  request: HelperFirmwareRequest,
): Promise<UploadResult> {
  if (native) return native.flashHelperFirmware(request);
  return { ok: false, stage: 'failed', verified: false, message: 'Native USB unavailable (Expo Go).' };
}

/** Send the Pico back to BOOTSEL mode via serial command (requires open serial). */
export async function enterBootselViaSerial(deviceId: string): Promise<boolean> {
  if (native) return native.enterBootselViaSerial(deviceId);
  return false;
}

/** SWD transfer (read or write a 32-bit word via SWD helper firmware). */
export async function swdTransfer(request: SwdTransferRequest): Promise<number> {
  if (native) return native.swdTransfer(request);
  throw new Error('SWD transfer requires native USB + SWD helper firmware.');
}

/** JTAG transfer (shift TMS/TDI and read TDO via JTAG helper firmware). */
export async function jtagTransfer(request: JtagTransferRequest): Promise<Uint8Array> {
  if (native) return native.jtagTransfer(request);
  throw new Error('JTAG transfer requires native USB + JTAG helper firmware.');
}

/** Check if an RP2040 device is in BOOTSEL mode. */
export async function isRp2040Bootsel(deviceId: string): Promise<boolean> {
  if (native) return native.isRp2040Bootsel(deviceId);
  return false;
}

/** Get the RP2040 mode (bootsel, application, or not-rp2040). */
export async function getRp2040Mode(
  deviceId: string,
): Promise<{ mode: RP2040Mode; isRP2040: boolean }> {
  if (native) return native.getRp2040Mode(deviceId);
  return { mode: 'not-rp2040', isRP2040: false };
}

// ---- Board utilities ----

import { identifyBoard, searchBoards, getProtocolFromDevice, guessProtocol } from '@droidvibe/shared';

/**
 * Get board information for a device
 */
export function getBoardInfo(device: UsbDevice) {
  return identifyBoard(device.vendorId, device.productId);
}

/**
 * Get the recommended protocol for a device
 */
export function getRecommendedProtocol(device: UsbDevice): string {
  return getProtocolFromDevice(device.vendorId, device.productId);
}

/**
 * Search for boards by name or other criteria
 */
export function searchBoardDatabase(query: string, limit: number = 20) {
  return searchBoards(query, limit);
}
