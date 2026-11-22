package com.nosotros.app.widget

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import androidx.core.graphics.createBitmap
import com.nosotros.app.data.ImageCompressor
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Prepara la foto para el widget: recorte centrado («centerCrop») a la forma
 * exacta del widget y esquinas redondeadas dibujadas en el propio bitmap, que
 * funciona igual en Android 8 que en 15 (el cornerRadius de Glance solo
 * existe desde Android 12).
 */
object WidgetBitmaps {
    /** Tope del lado largo: suficiente nitidez sin pasarse del límite de memoria de RemoteViews. */
    private const val MAX_SIDE_PX = 900

    fun roundedCrop(file: File, widthDp: Float, heightDp: Float, density: Float, cornerDp: Float): Bitmap? {
        if (!file.exists()) return null
        val wDp = if (widthDp > 0) widthDp else 160f
        val hDp = if (heightDp > 0) heightDp else 160f

        var outW = wDp * density
        var outH = hDp * density
        val cap = MAX_SIDE_PX / max(outW, outH)
        if (cap < 1f) { outW *= cap; outH *= cap }
        val targetW = outW.roundToInt().coerceAtLeast(1)
        val targetH = outH.roundToInt().coerceAtLeast(1)

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0) return null
        val source = BitmapFactory.decodeFile(
            file.path,
            BitmapFactory.Options().apply {
                inSampleSize = ImageCompressor.sampleSizeFor(bounds.outWidth, bounds.outHeight, max(targetW, targetH))
            },
        ) ?: return null

        // centerCrop: escala para cubrir y centra.
        val scale = max(targetW.toFloat() / source.width, targetH.toFloat() / source.height)
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate((targetW - source.width * scale) / 2f, (targetH - source.height * scale) / 2f)
        }
        val shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
            setLocalMatrix(matrix)
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { this.shader = shader }

        val output = createBitmap(targetW, targetH)
        val radius = cornerDp * density * (targetW / (wDp * density))
        Canvas(output).drawRoundRect(RectF(0f, 0f, targetW.toFloat(), targetH.toFloat()), radius, radius, paint)
        source.recycle()
        return output
    }
}
