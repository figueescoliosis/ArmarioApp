package com.nosotros.app.widget

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.layout.ContentScale
import com.nosotros.app.R
import com.nosotros.app.repository
import com.nosotros.app.ui.MainActivity

/**
 * Widget de fotos. Un solo GlanceAppWidget para los dos tamaños (2×2 y 4×2):
 * con SizeMode.Exact se dibuja al tamaño real que le da el launcher.
 *
 * El estado de cada widget (Glance) guarda qué foto toca. La lista de fotos
 * sale de la copia local, así que funciona sin conexión.
 */
class PhotoWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Exact

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { WidgetContent() }
    }

    companion object {
        val INDEX = intPreferencesKey("indice")
        /** Se incrementa para forzar que el widget vuelva a leer la lista. */
        val VERSION = intPreferencesKey("version")
    }
}

@Composable
private fun WidgetContent() {
    val context = LocalContext.current
    val prefs = currentState<Preferences>()
    val index = prefs[PhotoWidget.INDEX] ?: 0
    val version = prefs[PhotoWidget.VERSION] ?: 0

    val repository = context.repository
    val photos = remember(version) { repository.store.current() }
    val paired = remember(version) { repository.isPaired() }
    val size = LocalSize.current

    if (photos.isEmpty()) {
        Placeholder(if (paired) "Agrega fotos en Nosotros" else "Abre Nosotros para emparejarte")
        return
    }

    val photo = photos[Math.floorMod(index, photos.size)]
    val density = context.resources.displayMetrics.density
    val bitmap: Bitmap? = remember(photo.id, size) {
        WidgetBitmaps.roundedCrop(
            file = repository.store.file(photo),
            widthDp = size.width.value,
            heightDp = size.height.value,
            density = density,
            cornerDp = CORNER_DP,
        )
    }

    Box(
        modifier = GlanceModifier.fillMaxSize().clickable(actionRunCallback<NextPhotoAction>()),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(
                provider = ImageProvider(bitmap),
                contentDescription = "Foto del álbum",
                contentScale = ContentScale.FillBounds,
                modifier = GlanceModifier.fillMaxSize(),
            )
        } else {
            Placeholder("No se pudo abrir la foto")
        }
    }
}

@Composable
private fun Placeholder(message: String) {
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ImageProvider(R.drawable.widget_background))
            .clickable(actionStartActivity<MainActivity>()),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(
                provider = ImageProvider(R.drawable.ic_heart),
                contentDescription = null,
                modifier = GlanceModifier.size(32.dp),
            )
            Text(
                text = message,
                modifier = GlanceModifier.padding(horizontal = 12.dp, vertical = 6.dp),
                style = TextStyle(
                    color = ColorProvider(Color.White),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                ),
            )
        }
    }
}

private const val CORNER_DP = 20f

/** Tocar el widget pasa a la siguiente foto. */
class NextPhotoAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        updateAppWidgetState(context, glanceId) { prefs ->
            prefs[PhotoWidget.INDEX] = (prefs[PhotoWidget.INDEX] ?: 0) + 1
        }
        PhotoWidget().update(context, glanceId)
    }
}

/** Receptor del widget 2×2. */
class SmallPhotoWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PhotoWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        RotationScheduler.schedule(context)
    }
}

/** Receptor del widget 4×2. */
class WidePhotoWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PhotoWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        RotationScheduler.schedule(context)
    }
}
