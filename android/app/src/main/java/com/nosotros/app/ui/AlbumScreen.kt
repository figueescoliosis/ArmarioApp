package com.nosotros.app.ui

import android.appwidget.AppWidgetManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.nosotros.app.R
import com.nosotros.app.data.AlbumInfo
import com.nosotros.app.data.ImageCompressor
import com.nosotros.app.data.LocalPhoto
import com.nosotros.app.data.ConfigStore
import com.nosotros.app.repository
import com.nosotros.app.widget.SmallPhotoWidgetReceiver
import com.nosotros.app.widget.WidePhotoWidgetReceiver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

private const val POLL_MS = 5_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlbumScreen(vm: MainViewModel, ui: UiState, album: AlbumInfo) {
    val context = LocalContext.current
    val photos by vm.photos.collectAsStateWithLifecycle()
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var viewing by remember { mutableStateOf<LocalPhoto?>(null) }
    var confirmDelete by remember { mutableStateOf<LocalPhoto?>(null) }

    // Mientras la pantalla está visible, trae lo que haya subido la pareja.
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                vm.syncQuietly()
                delay(POLL_MS)
            }
        }
    }

    val pickPhotos = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(maxItems = 20),
    ) { uris -> vm.addPhotos(uris) }

    var cameraUri by rememberSaveable { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val uri = cameraUri
        if (saved && uri != null) vm.addPhotos(listOf(uri))
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Nosotros") },
                actions = {
                    IconButton(onClick = { showSettings = true }) {
                        Icon(painterResource(R.drawable.ic_more), contentDescription = "Ajustes")
                    }
                },
            )
        },
        floatingActionButton = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SmallFloatingActionButton(onClick = {
                    val uri = newCameraUri(context)
                    cameraUri = uri
                    try {
                        takePicture.launch(uri)
                    } catch (e: ActivityNotFoundException) {
                        Toast.makeText(context, "No hay app de cámara", Toast.LENGTH_SHORT).show()
                    }
                }) {
                    Icon(painterResource(R.drawable.ic_camera), contentDescription = "Tomar foto")
                }
                FloatingActionButton(onClick = {
                    pickPhotos.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }) {
                    Icon(painterResource(R.drawable.ic_add_photo), contentDescription = "Agregar fotos")
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            ui.upload?.let { (current, total) ->
                Text(
                    "Subiendo $current de $total…",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
                LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = 16.dp))
            }
            if (ui.offline) {
                Text(
                    "Sin conexión: mostrando las fotos guardadas en el teléfono",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            if (album.members < 2) WaitingPartnerCard(vm, album)

            if (photos.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text(
                        "Todavía no hay fotos.\nToca + para agregar las primeras.",
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                PhotoGrid(
                    photos = photos,
                    onOpen = { viewing = it },
                    onLongPress = { confirmDelete = it },
                )
            }
        }
    }

    viewing?.let { photo ->
        PhotoViewer(photo, onClose = { viewing = null }, onDelete = { viewing = null; confirmDelete = photo })
    }

    confirmDelete?.let { photo ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text("¿Eliminar esta foto?") },
            text = { Text("Se borrará para los dos y dejará de salir en el widget.") },
            confirmButton = {
                TextButton(onClick = { vm.deletePhoto(photo); confirmDelete = null }) { Text("Eliminar") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text("Cancelar") } },
        )
    }

    if (showSettings) {
        ModalBottomSheet(onDismissRequest = { showSettings = false }) {
            SettingsSheet(vm, ui, album, onDone = { showSettings = false })
        }
    }

    MessageDialog(ui.message, vm::dismissMessage)
}

@Composable
private fun WaitingPartnerCard(vm: MainViewModel, album: AlbumInfo) {
    val context = LocalContext.current
    Card(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Esperando a tu pareja", style = MaterialTheme.typography.titleMedium)
            Text("Que instale Nosotros y escriba este código, o mándale la invitación:")
            Text(
                album.code,
                style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Monospace),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { copy(context, album.code) }, modifier = Modifier.weight(1f)) {
                    Text("Copiar código")
                }
                OutlinedButton(onClick = { vm.invitationText()?.let { share(context, it) } }, modifier = Modifier.weight(1f)) {
                    Text("Compartir invitación")
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PhotoGrid(photos: List<LocalPhoto>, onOpen: (LocalPhoto) -> Unit, onLongPress: (LocalPhoto) -> Unit) {
    val context = LocalContext.current
    val store = context.repository.store
    LazyVerticalGrid(
        columns = GridCells.Adaptive(110.dp),
        contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 160.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(photos, key = { it.id }) { photo ->
            val bitmap = rememberBitmap(store.thumb(photo), maxSide = 400)
            Box(
                Modifier
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .combinedClickable(
                        onClick = { onOpen(photo) },
                        onLongClick = { onLongPress(photo) },
                        onLongClickLabel = "Eliminar",
                    ),
            ) {
                bitmap?.let {
                    Image(it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                }
            }
        }
    }
}

@Composable
private fun PhotoViewer(photo: LocalPhoto, onClose: () -> Unit, onDelete: () -> Unit) {
    val context = LocalContext.current
    val bitmap = rememberBitmap(context.repository.store.file(photo), maxSide = 2048)
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            bitmap?.let {
                Image(it, contentDescription = "Foto", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
            }
            Row(
                Modifier.align(Alignment.BottomCenter).padding(24.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                TextButton(onClick = onClose) { Text("Cerrar", color = Color.White) }
                TextButton(onClick = onDelete) {
                    Icon(painterResource(R.drawable.ic_delete), contentDescription = null, tint = Color.White)
                    Text(" Eliminar", color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun SettingsSheet(vm: MainViewModel, ui: UiState, album: AlbumInfo, onDone: () -> Unit) {
    val context = LocalContext.current
    var confirmLeave by remember { mutableStateOf(false) }
    var confirmRemove by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Widget", style = MaterialTheme.typography.titleMedium)
        Text("Cambiar de foto cada:", style = MaterialTheme.typography.bodyMedium)
        ConfigStore.ROTATION_OPTIONS.forEach { minutes ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = ui.rotationMinutes == minutes,
                        onClick = { vm.setRotation(minutes) },
                        role = Role.RadioButton,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = ui.rotationMinutes == minutes, onClick = null)
                Text(if (minutes < 60) "  $minutes minutos" else "  1 hora")
            }
        }
        Text(
            "Toca el widget para pasar a la siguiente foto. Android no permite rotar más seguido que cada 15 minutos.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { pinWidget(context, wide = false) }, modifier = Modifier.weight(1f)) {
                Text("Agregar 2×2")
            }
            OutlinedButton(onClick = { pinWidget(context, wide = true) }, modifier = Modifier.weight(1f)) {
                Text("Agregar 4×2")
            }
        }

        HorizontalDivider(Modifier.padding(vertical = 8.dp))

        Text("Álbum", style = MaterialTheme.typography.titleMedium)
        Text(
            "Código: ${album.code} · ${if (album.members >= 2) "2 personas" else "esperando a tu pareja"}",
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedButton(onClick = { vm.invitationText()?.let { share(context, it) } }, modifier = Modifier.fillMaxWidth()) {
            Text("Compartir invitación")
        }
        if (album.members >= 2) {
            TextButton(onClick = { confirmRemove = true }) { Text("Liberar el lugar de mi pareja") }
        }
        TextButton(onClick = { confirmLeave = true }) {
            Text("Salir del álbum", color = MaterialTheme.colorScheme.error)
        }
    }

    if (confirmRemove) {
        AlertDialog(
            onDismissRequest = { confirmRemove = false },
            title = { Text("¿Liberar su lugar?") },
            text = { Text("Úsalo si tu pareja reinstaló la app y no puede volver a entrar. Las fotos se conservan; podrá unirse otra vez con el código ${album.code}.") },
            confirmButton = { TextButton(onClick = { vm.removePartner(); confirmRemove = false }) { Text("Liberar") } },
            dismissButton = { TextButton(onClick = { confirmRemove = false }) { Text("Cancelar") } },
        )
    }
    if (confirmLeave) {
        AlertDialog(
            onDismissRequest = { confirmLeave = false },
            title = { Text("¿Salir del álbum?") },
            text = {
                Text(
                    if (album.members >= 2) "Dejarás de ver las fotos. Tu pareja las conserva y podrás volver con el código."
                    else "Eres la única persona del álbum: se borrarán el álbum y todas sus fotos.",
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.leaveAlbum(); confirmLeave = false; onDone() }) { Text("Salir") }
            },
            dismissButton = { TextButton(onClick = { confirmLeave = false }) { Text("Cancelar") } },
        )
    }
}

/** Decodifica una imagen local fuera del hilo principal. */
@Composable
private fun rememberBitmap(file: File, maxSide: Int): ImageBitmap? {
    val state = produceState<ImageBitmap?>(initialValue = null, file) {
        value = withContext(Dispatchers.IO) {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            if (bounds.outWidth <= 0) return@withContext null
            BitmapFactory.decodeFile(
                file.path,
                BitmapFactory.Options().apply {
                    inSampleSize = ImageCompressor.sampleSizeFor(bounds.outWidth, bounds.outHeight, maxSide)
                },
            )?.asImageBitmap()
        }
    }
    return state.value
}

private fun newCameraUri(context: Context): Uri {
    val dir = File(context.cacheDir, "camara").apply { mkdirs() }
    val file = File(dir, "foto_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

private fun copy(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("Código de Nosotros", text))
    Toast.makeText(context, "Copiado", Toast.LENGTH_SHORT).show()
}

private fun share(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(send, "Compartir invitación"))
}

/** Pide al launcher que agregue el widget (si lo admite); si no, explica cómo. */
private fun pinWidget(context: Context, wide: Boolean) {
    val manager = AppWidgetManager.getInstance(context)
    val receiver = if (wide) WidePhotoWidgetReceiver::class.java else SmallPhotoWidgetReceiver::class.java
    if (manager.isRequestPinAppWidgetSupported) {
        manager.requestPinAppWidget(ComponentName(context, receiver), null, null)
    } else {
        Toast.makeText(
            context,
            "Mantén presionada la pantalla de inicio → Widgets → Nosotros",
            Toast.LENGTH_LONG,
        ).show()
    }
}
