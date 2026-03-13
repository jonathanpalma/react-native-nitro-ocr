package com.margelo.nitro.nitroocr

import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.ConcurrentHashMap

internal object RecognizerCache {
    private val cache = ConcurrentHashMap<String, TextRecognizer>()

    fun get(scriptHints: Array<ScriptHint>?, languages: Array<String>?): TextRecognizer {
        val script = resolveScript(scriptHints, languages)
        return cache.computeIfAbsent(script) { createRecognizer(it) }
    }

    fun closeAll() {
        for (recognizer in cache.values) {
            try {
                recognizer.close()
            } catch (_: Exception) {
                // Best-effort: dispose() must not throw per Nitro HybridObject contract
            }
        }
        cache.clear()
    }

    private fun resolveScript(scriptHints: Array<ScriptHint>?, languages: Array<String>?): String {
        if (scriptHints != null && scriptHints.isNotEmpty()) {
            return scriptHints[0].name.lowercase()
        }
        if (languages != null && languages.isNotEmpty()) {
            return mapLanguageToScript(languages[0])
        }
        return "latin"
    }

    private fun mapLanguageToScript(lang: String): String {
        val prefix = lang.split("-")[0].lowercase()
        return when (prefix) {
            "zh" -> "chinese"
            "ja" -> "japanese"
            "ko" -> "korean"
            "hi", "mr", "ne" -> "devanagari"
            else -> "latin"
        }
    }

    private fun createRecognizer(script: String): TextRecognizer {
        return when (script) {
            "latin" -> TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            "chinese" -> tryCreate(script) {
                TextRecognition.getClient(
                    com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions.Builder().build()
                )
            }
            "japanese" -> tryCreate(script) {
                TextRecognition.getClient(
                    com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions.Builder().build()
                )
            }
            "korean" -> tryCreate(script) {
                TextRecognition.getClient(
                    com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions.Builder().build()
                )
            }
            "devanagari" -> tryCreate(script) {
                TextRecognition.getClient(
                    com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions.Builder().build()
                )
            }
            else -> throw Exception("MODEL_NOT_AVAILABLE: Unknown script '$script'")
        }
    }

    private fun tryCreate(script: String, factory: () -> TextRecognizer): TextRecognizer {
        return try {
            factory()
        } catch (_: ClassNotFoundException) {
            throw Exception(
                "MODEL_NOT_AVAILABLE: Script model '$script' is not available. " +
                "Add 'com.google.mlkit:text-recognition-$script' to your app's build.gradle."
            )
        } catch (_: NoClassDefFoundError) {
            throw Exception(
                "MODEL_NOT_AVAILABLE: Script model '$script' is not available. " +
                "Add 'com.google.mlkit:text-recognition-$script' to your app's build.gradle."
            )
        }
    }
}
