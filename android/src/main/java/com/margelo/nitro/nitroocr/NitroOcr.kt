package com.margelo.nitro.nitroocr

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.margelo.nitro.core.Promise
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

@DoNotStrip
@Keep
class NitroOcr : HybridNitroOcrSpec() {

    override val memorySize: Long
        get() = 128L

    override fun dispose() {
        RecognizerCache.closeAll()
    }

    override fun recognize(source: String, options: RecognizeOptions?): Promise<OCRResult> {
        return Promise.async {
            val (inputImage, width, height) = ImageSourceResolver.resolve(source)
            val recognizer = RecognizerCache.get(options?.scriptHints, options?.languages)
            val text = awaitTask(recognizer.process(inputImage))
            ResultMapper.mapResult(text, width, height)
        }
    }

    override fun recognizeText(source: String, options: RecognizeOptions?): Promise<String> {
        return Promise.async {
            val (inputImage, _, _) = ImageSourceResolver.resolve(source)
            val recognizer = RecognizerCache.get(options?.scriptHints, options?.languages)
            val text = awaitTask(recognizer.process(inputImage))
            text.textBlocks.joinToString("\n\n") { it.text }
        }
    }

    override fun getSupportedLanguages(): Promise<Array<String>> {
        return Promise.async {
            val languages = mutableListOf(
                "en", "es", "fr", "de", "it", "pt",
                "nl", "pl", "ro", "sv", "tr", "vi"
            )
            if (isClassAvailable("com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions")) {
                languages.addAll(listOf("zh", "zh-Hans", "zh-Hant"))
            }
            if (isClassAvailable("com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions")) {
                languages.add("ja")
            }
            if (isClassAvailable("com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions")) {
                languages.add("ko")
            }
            if (isClassAvailable("com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions")) {
                languages.addAll(listOf("hi", "mr", "ne"))
            }
            languages.toTypedArray()
        }
    }

    private fun <T> awaitTask(task: com.google.android.gms.tasks.Task<T>): T {
        try {
            return Tasks.await(task, 60, TimeUnit.SECONDS)
        } catch (e: ExecutionException) {
            throw e.cause ?: Exception("RECOGNITION_FAILED: ${e.message}")
        } catch (_: TimeoutException) {
            throw Exception("RECOGNITION_FAILED: Recognition timed out after 60 seconds")
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            throw Exception("CANCELLED: Recognition was interrupted")
        } catch (_: CancellationException) {
            throw Exception("CANCELLED: Recognition was cancelled")
        }
    }

    private fun isClassAvailable(className: String): Boolean {
        return try {
            Class.forName(className)
            true
        } catch (_: ClassNotFoundException) {
            false
        }
    }
}
