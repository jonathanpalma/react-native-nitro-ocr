package com.margelo.nitro.nitroocr

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.margelo.nitro.NitroModules
import java.io.ByteArrayInputStream
import java.io.File

internal object ImageSourceResolver {

    fun resolve(source: String): Triple<InputImage, Int, Int> {
        if (source.isEmpty()) {
            throw Exception("INVALID_SOURCE: Source string is empty")
        }

        val context = NitroModules.applicationContext
            ?: throw Exception("RECOGNITION_FAILED: React context not available")

        return when {
            source.startsWith("data:image/") -> resolveBase64(source)
            source.startsWith("content://") -> resolveContentUri(source, context)
            source.startsWith("file://") -> resolveFilePath(source.removePrefix("file://"), context)
            source.startsWith("/") -> resolveFilePath(source, context)
            source.startsWith("ph://") -> throw Exception("INVALID_SOURCE: ph:// URIs are not supported on Android")
            else -> throw Exception("INVALID_SOURCE: Unsupported URI scheme in '$source'")
        }
    }

    private fun resolveFilePath(path: String, context: Context): Triple<InputImage, Int, Int> {
        val file = File(path)
        if (!file.exists()) {
            throw Exception("IMAGE_LOAD_FAILED: File not found at $path")
        }
        try {
            val uri = Uri.fromFile(file)
            val inputImage = InputImage.fromFilePath(context, uri)
            return Triple(inputImage, inputImage.width, inputImage.height)
        } catch (e: Exception) {
            throw Exception("IMAGE_LOAD_FAILED: Could not decode image at $path: ${e.message}")
        }
    }

    private fun resolveContentUri(source: String, context: Context): Triple<InputImage, Int, Int> {
        try {
            val uri = Uri.parse(source)
            val inputImage = InputImage.fromFilePath(context, uri)
            return Triple(inputImage, inputImage.width, inputImage.height)
        } catch (e: Exception) {
            throw Exception("IMAGE_LOAD_FAILED: Could not resolve content URI: ${e.message}")
        }
    }

    private fun resolveBase64(source: String): Triple<InputImage, Int, Int> {
        try {
            val base64Data = source.substringAfter("base64,")
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)

            val exif = ExifInterface(ByteArrayInputStream(bytes))
            val rotation = when (exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }

            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                ?: throw Exception("IMAGE_LOAD_FAILED: Could not decode base64 image data")
            val inputImage = InputImage.fromBitmap(bitmap, rotation)
            return Triple(inputImage, bitmap.width, bitmap.height)
        } catch (e: Exception) {
            if (e.message?.startsWith("IMAGE_LOAD_FAILED") == true) throw e
            throw Exception("IMAGE_LOAD_FAILED: Could not decode base64 image data")
        }
    }
}
