package com.nosotros.app.data

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageCompressorTest {
    @Test
    fun `el submuestreo nunca baja del tamaño pedido`() {
        assertEquals(2, ImageCompressor.sampleSizeFor(4000, 3000, 1080)) // 2000 px ≥ 1080
        assertEquals(4, ImageCompressor.sampleSizeFor(3000, 4500, 1080)) // 1125 px ≥ 1080
        assertEquals(1, ImageCompressor.sampleSizeFor(1080, 720, 1080))
        assertEquals(1, ImageCompressor.sampleSizeFor(800, 600, 1080))
    }
}
