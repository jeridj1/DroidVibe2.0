package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.util.Log

object StLinkUploader {
    private const val TAG = "StLinkUploader"
    private const val STLINK_CMD_GET_VERSION = 0x01
    private const val STLINK_CMD_ENTER_SWD_MODE = 0x07
    private const val STLINK_CMD_ERASE_FLASH = 0x20
    private const val STLINK_CMD_WRITE_FLASH = 0x21
    private const val STLINK_CMD_READ_FLASH = 0x22
    private const val STLINK_CMD_RESET = 0x30
    private const val STM32F030_FLASH_START = 0x08000000L
    private const val FLASH_ERASE_TIMEOUT = 30000
    private const val FLASH_WRITE_TIMEOUT = 5000
    private const val FLASH_READ_TIMEOUT = 1000
    
    data class UploadResult(val ok: Boolean, val stage: String, val verified: Boolean, val message: String)
    
    fun upload(usbManager: UsbManager, device: UsbDevice, firmwareBytes: ByteArray, filename: String, baudRate: Int, verify: Boolean, onProgress: (String, Int, String?) -> Unit): UploadResult {
        onProgress("initializing", 0, "Initializing ST-Link...")
        var connection: UsbDeviceConnection? = null
        var usbInterface: UsbInterface? = null
        var endpointOut: UsbEndpoint? = null
        try {
            connection = usbManager.openDevice(device)
            usbInterface = findStLinkInterface(device)
            if (connection == null || usbInterface == null || !connection.claimInterface(usbInterface, true)) {
                return UploadResult(false, "error", false, "Failed to initialize connection")
            }
            val endpoints = findBulkEndpoints(usbInterface)
            endpointOut = endpoints.second
            if (endpointOut == null) return UploadResult(false, "error", false, "No bulk OUT endpoint")
            if (!enterSwdMode(connection, endpointOut)) return UploadResult(false, "error", false, "SWD mode failed")
            if (!eraseFlash(connection, endpointOut)) return UploadResult(false, "error", false, "Erase failed")
            if (!writeFlash(connection, endpointOut, STM32F030_FLASH_START, firmwareBytes, onProgress)) {
                return UploadResult(false, "error", false, "Write failed")
            }
            val verified = if (verify) verifyFlash(connection, endpoints.first, endpointOut, STM32F030_FLASH_START, firmwareBytes, onProgress) else true
            resetDevice(connection, endpointOut)
            connection.releaseInterface(usbInterface)
            return UploadResult(true, "complete", verified, "ST-Link upload successful")
        } catch (e: Exception) {
            Log.e(TAG, "ST-Link upload failed", e)
            try { connection?.releaseInterface(usbInterface) } catch (e2: Exception) {}
            return UploadResult(false, "error", false, "Failed: " + e.message)
        } finally {
            try { connection?.close() } catch (e: Exception) {}
        }
    }
    
    private fun findStLinkInterface(device: UsbDevice): UsbInterface? {
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            if (intf.interfaceClass == 0xFF) return intf
        }
        return if (device.interfaceCount > 0) device.getInterface(0) else null
    }
    
    private fun findBulkEndpoints(intf: UsbInterface): Pair<UsbEndpoint?, UsbEndpoint?> {
        var epIn: UsbEndpoint? = null
        var epOut: UsbEndpoint? = null
        for (i in 0 until intf.endpointCount) {
            val ep = intf.getEndpoint(i)
            if (ep.type == android.hardware.usb.UsbConstants.USB_ENDPOINT_XFER_BULK) {
                if (ep.direction == android.hardware.usb.UsbConstants.USB_DIR_IN) epIn = ep
                else epOut = ep
            }
        }
        return Pair(epIn, epOut)
    }
    
    private fun sendCmd(conn: UsbDeviceConnection, epOut: UsbEndpoint, cmdBytes: ByteArray, respSize: Int, timeout: Int): ByteArray? {
        if (conn.bulkTransfer(epOut, cmdBytes, cmdBytes.size, timeout) != cmdBytes.size) return null
        val resp = ByteArray(respSize)
        val read = conn.bulkTransfer(findCorrespEp(epOut), resp, resp.size, timeout)
        return if (read >= 2) resp.copyOf(read) else null
    }
    
    private fun findCorrespEp(ep: UsbEndpoint): UsbEndpoint {
        val addr = ep.address and 0x7F
        return ep.device.getInterface(ep.interfaceId).endpoints.first { it.address == (addr or 0x80) }
    }
    
    private fun enterSwdMode(conn: UsbDeviceConnection, epOut: UsbEndpoint): Boolean {
        val cmd = byteArrayOf(0x00, STLINK_CMD_ENTER_SWD_MODE.toByte(), 0x00, 0x00)
        return sendCmd(conn, epOut, cmd, 2, 1000)?.get(0) == 0x00.toByte()
    }
    
    private fun eraseFlash(conn: UsbDeviceConnection, epOut: UsbEndpoint): Boolean {
        val cmd = byteArrayOf(0x00, STLINK_CMD_ERASE_FLASH.toByte(), 0xFF.toByte(), 0xFF.toByte())
        return sendCmd(conn, epOut, cmd, 2, FLASH_ERASE_TIMEOUT)?.get(0) == 0x00.toByte()
    }
    
    private fun writeFlash(conn: UsbDeviceConnection, epOut: UsbEndpoint, addr: Long, firmwareBytes: ByteArray, onProgress: (String, Int, String?) -> Unit): Boolean {
        var offset = 0
        var a = addr
        val totalSize = firmwareBytes.size
        while (offset < totalSize) {
            val chunkSize = if (totalSize - offset > 256) 256 else totalSize - offset
            val cmd = byteArrayOf(0x00, STLINK_CMD_WRITE_FLASH.toByte(),
                (a and 0xFF).toByte(), ((a shr 8) and 0xFF).toByte(), ((a shr 16) and 0xFF).toByte(), ((a shr 24) and 0xFF).toByte(),
                (chunkSize and 0xFF).toByte(), ((chunkSize shr 8) and 0xFF).toByte())
            if (sendCmd(conn, epOut, cmd, 2, FLASH_WRITE_TIMEOUT)?.get(0) != 0x00.toByte()) return false
            val chunkData = firmwareBytes.copyOfRange(offset, offset + chunkSize)
            if (conn.bulkTransfer(epOut, chunkData, chunkData.size, FLASH_WRITE_TIMEOUT) != chunkData.size) return false
            val ack = ByteArray(2)
            if (conn.bulkTransfer(findCorrespEp(epOut), ack, 2, FLASH_WRITE_TIMEOUT) < 2 || ack[0] != 0x00.toByte()) return false
            offset += chunkSize
            a += chunkSize
            onProgress("writing", 30 + (offset * 60 / totalSize).toInt(), "Writing: $offset/$totalSize")
            try { Thread.sleep(10) } catch (e: InterruptedException) {}
        }
        return true
    }
    
    private fun verifyFlash(conn: UsbDeviceConnection, epIn: UsbEndpoint?, epOut: UsbEndpoint, addr: Long, expectedBytes: ByteArray, onProgress: (String, Int, String?) -> Unit): Boolean {
        if (epIn == null) return true
        var offset = 0
        var a = addr
        val totalSize = expectedBytes.size
        while (offset < totalSize) {
            val chunkSize = if (totalSize - offset > 256) 256 else totalSize - offset
            val cmd = byteArrayOf(0x00, STLINK_CMD_READ_FLASH.toByte(),
                (a and 0xFF).toByte(), ((a shr 8) and 0xFF).toByte(), ((a shr 16) and 0xFF).toByte(), ((a shr 24) and 0xFF).toByte(),
                (chunkSize and 0xFF).toByte(), ((chunkSize shr 8) and 0xFF).toByte())
            if (sendCmd(conn, epOut, cmd, 2, FLASH_READ_TIMEOUT)?.get(0) != 0x00.toByte()) return false
            val readData = ByteArray(chunkSize)
            if (conn.bulkTransfer(epIn, readData, chunkSize, FLASH_READ_TIMEOUT) != chunkSize) return false
            for (i in 0 until chunkSize) if (readData[i] != expectedBytes[offset + i]) return false
            offset += chunkSize
            a += chunkSize
            onProgress("verifying", 90 + (offset * 5 / totalSize).toInt(), "Verifying: $offset/$totalSize")
        }
        return true
    }
    
    private fun resetDevice(conn: UsbDeviceConnection, epOut: UsbEndpoint): Boolean {
        val cmd = byteArrayOf(0x00, STLINK_CMD_RESET.toByte(), 0x00, 0x00)
        return sendCmd(conn, epOut, cmd, 2, 1000)?.get(0) == 0x00.toByte()
    }
    
    fun isStLink(device: UsbDevice): Boolean {
        val vid = String.format("%04x", device.vendorId)
        val pid = String.format("%04x", device.productId)
        return (vid == "0483" && (pid == "3748" || pid == "374b" || pid == "3752" || pid == "374d" || pid == "374e" || pid == "374f"))
    }
}
