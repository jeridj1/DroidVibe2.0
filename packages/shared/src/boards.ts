/**
 * VID/PID -> board identity database.
 *
 * Compiled from public Arduino/clone board descriptors. Used by the Devices
 * screen to identify a connected board and pick a sensible default upload
 * protocol and FQBN. Matches are best-effort; an unknown VID/PID resolves to
 * a generic identity with protocol 'unknown'-equivalent handled by callers.
 *
 * ENHANCED for DroidVibe 2.0 with user's specific hardware support
 */
import type { BoardIdentity, UploadProtocol } from './types.js';

const DB: BoardIdentity[] = [
  // --- Arduino / Genuino (originals, CDC-ACM) ---
  { vendorId: '2341', productId: '0010', name: 'Arduino Uno', manufacturer: 'Arduino', fqbn: 'arduino:avr:uno', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '0043', name: 'Arduino Uno R3', manufacturer: 'Arduino', fqbn: 'arduino:avr:uno', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '0001', name: 'Arduino Mega 2560', manufacturer: 'Arduino', fqbn: 'arduino:avr:mega', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '0010', name: 'Arduino Mega 2560', manufacturer: 'Arduino', fqbn: 'arduino:avr:mega', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '003f', name: 'Arduino Mega ADK', manufacturer: 'Arduino', fqbn: 'arduino:avr:megaADK', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '0042', name: 'Arduino Mega 2560 R3', manufacturer: 'Arduino', fqbn: 'arduino:avr:mega', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '0036', name: 'Arduino Leonardo', manufacturer: 'Arduino', fqbn: 'arduino:avr:leonardo', protocol: 'avr109' },
  { vendorId: '2341', productId: '003c', name: 'Arduino Micro', manufacturer: 'Arduino', fqbn: 'arduino:avr:micro', protocol: 'avr109' },
  { vendorId: '2341', productId: '8036', name: 'Arduino Leonardo ETH', manufacturer: 'Arduino', fqbn: 'arduino:avr:leonardoeth', protocol: 'avr109' },
  { vendorId: '2341', productId: '8037', name: 'Arduino Micro (Alt)', manufacturer: 'Arduino', fqbn: 'arduino:avr:micro', protocol: 'avr109' },

  // --- Arduino.cc / 3rd party megaAVR ---
  { vendorId: '2341', productId: '8057', name: 'Arduino Nano Every', manufacturer: 'Arduino', fqbn: 'arduino:megaavr:nona4809', protocol: 'stk500v1' },
  { vendorId: '2341', productId: '8058', name: 'Arduino Uno WiFi Rev2', manufacturer: 'Arduino', fqbn: 'arduino:megaavr:uno2018', protocol: 'stk500v1' },

  // --- Arduino R4 Series (Renesas RA4M1) ---
  { vendorId: '2341', productId: '805a', name: 'Arduino R4 Minima', manufacturer: 'Arduino', fqbn: 'arduino:renesas:r4minima', protocol: 'arduino-r4', notes: 'Uses Renesas RA4M1 chip with custom bootloader' },
  { vendorId: '2341', productId: '805b', name: 'Arduino R4 Minima WiFi', manufacturer: 'Arduino', fqbn: 'arduino:renesas:r4minima', protocol: 'arduino-r4', notes: 'Uses Renesas RA4M1 chip with WiFi, custom bootloader' },

  // --- Clones with CH340 (cheap Uno/Mega/Nano clones) ---
  { vendorId: '1a86', productId: '7523', name: 'CH340 (Uno/Mega/Nano clone)', manufacturer: 'QinHeng', fqbn: 'arduino:avr:uno', protocol: 'stk500v1', notes: 'Common clone bridge. FQBN depends on the actual board.' },
  { vendorId: '1a86', productId: '7523', name: 'Arduino Nano (CH340 clone)', manufacturer: 'QinHeng', fqbn: 'arduino:avr:nano', protocol: 'stk500v1', notes: 'CH340-based Nano clone' },
  // CH9102 (same function, newer CH340 variant)
  { vendorId: '1a86', productId: '55d4', name: 'CH9102 (clone bridge)', manufacturer: 'QinHeng', fqbn: 'arduino:avr:nano', protocol: 'stk500v1', notes: 'CH9102F USB bridge on newer clones.' },

  // --- DigiSpark (ATtiny85 with Micronucleus bootloader) ---
  { vendorId: '16d0', productId: '0483', name: 'DigiSpark (ATtiny85)', manufacturer: 'Digistump', fqbn: 'digistump:avr:digispark', protocol: 'micronucleus', notes: 'Uses Micronucleus bootloader, requires special timing' },
  { vendorId: '16d0', productId: '0483', name: 'DigiSpark Pro', manufacturer: 'Digistump', fqbn: 'digistump:avr:digispark', protocol: 'micronucleus' },

  // --- STM32 with ST-Link ---
  { vendorId: '0483', productId: '3748', name: 'ST-Link V2', manufacturer: 'STMicroelectronics', fqbn: 'stm32:stm32:stm32f030', protocol: 'stlink', notes: 'ST-Link V2 programmer for STM32 chips' },
  { vendorId: '0483', productId: '374b', name: 'ST-Link V2.1', manufacturer: 'STMicroelectronics', fqbn: 'stm32:stm32:stm32f030', protocol: 'stlink' },
  { vendorId: '0483', productId: '3752', name: 'STM32F030F4P6 (via ST-Link)', manufacturer: 'STMicroelectronics', fqbn: 'stm32:stm32:stm32f030f4p6', protocol: 'stlink', notes: 'Requires ST-Link programmer' },

  // --- CP210x (ESP boards, some clones) ---
  { vendorId: '10c4', productId: 'ea60', name: 'CP210x (ESP32/ESP8266)', manufacturer: 'Silicon Labs', fqbn: 'esp32:esp32:esp32', protocol: 'esptool', notes: 'Generic CP2102 bridge; very common on ESP32 boards.' },
  { vendorId: '10c4', productId: 'ea63', name: 'CP2104 (ESP boards)', manufacturer: 'Silicon Labs', fqbn: 'esp32:esp32:esp32', protocol: 'esptool' },

  // --- FTDI (FT232) ---
  { vendorId: '0403', productId: '6001', name: 'FT232 (Arduino FTDI)', manufacturer: 'FTDI', fqbn: 'arduino:avr:uno', protocol: 'stk500v1', notes: 'FTDI bridge on older Arduino clones/boards.' },

  // --- Raspberry Pi RP2040 / Pico ---
  { vendorId: '2e8a', productId: '0003', name: 'Raspberry Pi Pico (PICOBOOT)', manufacturer: 'Raspberry Pi', fqbn: 'rp2040:rp2040:rpipico', protocol: 'picoboot' },
  { vendorId: '2e8a', productId: '000a', name: 'Raspberry Pi Pico (CDC-ACM)', manufacturer: 'Raspberry Pi', fqbn: 'rp2040:rp2040:rpipico', protocol: 'picoboot', notes: 'Pico running CDC-ACM firmware; BOOTSEL resets into picoboot.' },
  { vendorId: '2e8a', productId: '0003', name: 'Raspberry Pi Pico W', manufacturer: 'Raspberry Pi', fqbn: 'rp2040:rp2040:picow', protocol: 'picoboot' },

  // --- ESP boards (CP210x/CH340 covered above; native USB ESP32-S2/S3) ---
  { vendorId: '303a', productId: '0001', name: 'ESP32-S2 (native USB)', manufacturer: 'Espressif', fqbn: 'esp32:esp32:esp32s2', protocol: 'esptool' },
  { vendorId: '303a', productId: '0002', name: 'ESP32-S3 (native USB)', manufacturer: 'Espressif', fqbn: 'esp32:esp32:esp32s3', protocol: 'esptool' },
];

function norm(v: string): string {
  return v.toLowerCase().replace(/^0x/, '').padStart(4, '0');
}

/** Identify a board from a VID/PID pair. Returns null when unknown. */
export function identifyBoard(vendorId: string, productId: string): BoardIdentity | null {
  const v = norm(vendorId);
  const p = norm(productId);
  for (const b of DB) {
    if (norm(b.vendorId) === v && norm(b.productId) === p) return b;
  }
  return null;
}

/** Guess a sensible default protocol for an unknown device family. */
export function guessProtocol(vendorId: string, productId: string): UploadProtocol {
  const id = identifyBoard(vendorId, productId);
  return id ? id.protocol : 'stk500v1';
}

/**
 * Get protocol from device VID/PID with enhanced detection
 * This is the main function used by the native USB module
 */
export function getProtocolFromDevice(vendorId: string, productId: string): UploadProtocol {
  const board = identifyBoard(vendorId, productId);
  if (board) {
    return board.protocol;
  }
  
  // Fallback: guess based on vendor ID
  const v = norm(vendorId);
  
  // Arduino original
  if (v === '2341') return 'stk500v1';
  
  // CH340/CH9102 clones (common for Uno/Nano clones)
  if (v === '1a86') return 'stk500v1';
  
  // CP210x (ESP boards)
  if (v === '10c4' || v === '303a') return 'esptool';
  
  // FTDI
  if (v === '0403') return 'stk500v1';
  
  // RP2040
  if (v === '2e8a') return 'picoboot';
  
  // ST-Link
  if (v === '0483') return 'stlink';
  
  // DigiSpark
  if (v === '16d0') return 'micronucleus';
  
  // Default fallback
  return 'stk500v1';
}

/**
 * Search boards by name, manufacturer, or other criteria
 * Used for the board search feature
 */
export function searchBoards(query: string, limit: number = 20): BoardIdentity[] {
  const q = query.toLowerCase();
  return DB
    .filter(b => 
      b.name.toLowerCase().includes(q) ||
      b.manufacturer.toLowerCase().includes(q) ||
      (b.notes && b.notes.toLowerCase().includes(q)) ||
      b.fqbn.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

/**
 * Get all unique manufacturers
 */
export function getManufacturers(): string[] {
  const manufacturers = new Set<string>();
  DB.forEach(b => manufacturers.add(b.manufacturer));
  return Array.from(manufacturers).sort();
}

/**
 * Get all unique protocols
 */
export function getProtocols(): UploadProtocol[] {
  const protocols = new Set<UploadProtocol>();
  DB.forEach(b => protocols.add(b.protocol));
  return Array.from(protocols).sort() as UploadProtocol[];
}
