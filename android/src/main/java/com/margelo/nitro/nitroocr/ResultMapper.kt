package com.margelo.nitro.nitroocr

import android.graphics.Rect

internal object ResultMapper {

    fun mapResult(
        text: com.google.mlkit.vision.text.Text,
        imageWidth: Int,
        imageHeight: Int
    ): OCRResult {
        val blocks = text.textBlocks.map { mapBlock(it, imageWidth, imageHeight) }.toTypedArray()
        return OCRResult(
            text = text.textBlocks.joinToString("\n\n") { it.text },
            blocks = blocks
        )
    }

    private fun mapBlock(
        block: com.google.mlkit.vision.text.Text.TextBlock,
        w: Int,
        h: Int
    ): OCRBlock {
        val lines = block.lines.map { mapLine(it, w, h) }.toTypedArray()
        val confidence = if (lines.isNotEmpty()) {
            lines.map { it.confidence }.average()
        } else {
            0.0
        }
        val bbox = normalizeBounds(block.boundingBox, w, h)
        return OCRBlock(
            text = block.text,
            confidence = confidence,
            boundingBox = bbox,
            cornerPoints = normalizeCorners(block.cornerPoints, w, h, bbox),
            recognizedLanguages = lines.flatMap { it.recognizedLanguages.toList() }
                .distinct()
                .toTypedArray(),
            lines = lines
        )
    }

    private fun mapLine(
        line: com.google.mlkit.vision.text.Text.Line,
        w: Int,
        h: Int
    ): OCRLine {
        val elements = line.elements.map { mapElement(it, w, h) }.toTypedArray()
        val bbox = normalizeBounds(line.boundingBox, w, h)
        return OCRLine(
            text = line.text,
            confidence = line.confidence.toDouble(),
            boundingBox = bbox,
            cornerPoints = normalizeCorners(line.cornerPoints, w, h, bbox),
            recognizedLanguages = elements.mapNotNull { el ->
                el.recognizedLanguage.takeIf { it.isNotEmpty() }
            }.distinct().toTypedArray(),
            angle = line.angle.toDouble(),
            elements = elements
        )
    }

    private fun mapElement(
        element: com.google.mlkit.vision.text.Text.Element,
        w: Int,
        h: Int
    ): OCRElement {
        val symbols = element.symbols.map { mapSymbol(it, w, h) }.toTypedArray()
        val bbox = normalizeBounds(element.boundingBox, w, h)
        return OCRElement(
            text = element.text,
            confidence = element.confidence.toDouble(),
            boundingBox = bbox,
            cornerPoints = normalizeCorners(element.cornerPoints, w, h, bbox),
            recognizedLanguage = element.recognizedLanguage ?: "",
            symbols = symbols
        )
    }

    private fun mapSymbol(
        symbol: com.google.mlkit.vision.text.Text.Symbol,
        w: Int,
        h: Int
    ): OCRSymbol {
        val bbox = normalizeBounds(symbol.boundingBox, w, h)
        return OCRSymbol(
            text = symbol.text,
            confidence = symbol.confidence.toDouble(),
            boundingBox = bbox,
            cornerPoints = normalizeCorners(symbol.cornerPoints, w, h, bbox)
        )
    }

    private fun normalizeBounds(rect: Rect?, w: Int, h: Int): BoundingBox {
        if (rect == null || w <= 0 || h <= 0) return BoundingBox(0.0, 0.0, 0.0, 0.0)
        return BoundingBox(
            x = rect.left.toDouble() / w,
            y = rect.top.toDouble() / h,
            width = rect.width().toDouble() / w,
            height = rect.height().toDouble() / h
        )
    }

    private fun normalizeCorners(
        points: Array<android.graphics.Point>?,
        w: Int,
        h: Int,
        fallbackBox: BoundingBox
    ): Array<Point> {
        if (points != null && points.size == 4 && w > 0 && h > 0) {
            return points.map { Point(it.x.toDouble() / w, it.y.toDouble() / h) }.toTypedArray()
        }
        return arrayOf(
            Point(fallbackBox.x, fallbackBox.y),
            Point(fallbackBox.x + fallbackBox.width, fallbackBox.y),
            Point(fallbackBox.x + fallbackBox.width, fallbackBox.y + fallbackBox.height),
            Point(fallbackBox.x, fallbackBox.y + fallbackBox.height)
        )
    }
}
