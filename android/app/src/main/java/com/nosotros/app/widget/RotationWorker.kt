package com.nosotros.app.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.nosotros.app.repository
import java.util.concurrent.TimeUnit

/**
 * Cada X minutos: intenta traer fotos nuevas (si no hay red, sigue con las que
 * tiene) y pasa los widgets a la siguiente foto.
 */
class RotationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        runCatching { applicationContext.repository.sync() }
        WidgetUpdater.refresh(applicationContext, advance = true)
        return Result.success()
    }
}

object RotationScheduler {
    private const val WORK_NAME = "rotacion_widget"

    /**
     * Programa la rotación con el intervalo guardado. [replace] = true cuando el
     * usuario cambia el intervalo; si no, se respeta el trabajo ya programado.
     * Android no permite periodos de menos de 15 minutos.
     */
    fun schedule(context: Context, replace: Boolean = false) {
        val minutes = context.repository.configStore.rotationMinutes.coerceAtLeast(15).toLong()
        val request = PeriodicWorkRequestBuilder<RotationWorker>(minutes, TimeUnit.MINUTES)
            .setInitialDelay(minutes, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            if (replace) ExistingPeriodicWorkPolicy.UPDATE else ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }
}

object WidgetUpdater {
    /**
     * Redibuja todos los widgets.
     * - [advance]: pasa a la siguiente foto (rotación).
     * - [showNewest]: vuelve a la primera, que es la más reciente (foto recién subida).
     */
    suspend fun refresh(context: Context, advance: Boolean = false, showNewest: Boolean = false) {
        val manager = GlanceAppWidgetManager(context)
        val widget = PhotoWidget()
        for (id in manager.getGlanceIds(PhotoWidget::class.java)) {
            updateAppWidgetState(context, id) { prefs ->
                val index = prefs[PhotoWidget.INDEX] ?: 0
                prefs[PhotoWidget.INDEX] = when {
                    showNewest -> 0
                    advance -> index + 1
                    else -> index
                }
                prefs[PhotoWidget.VERSION] = (prefs[PhotoWidget.VERSION] ?: 0) + 1
            }
            widget.update(context, id)
        }
    }
}
