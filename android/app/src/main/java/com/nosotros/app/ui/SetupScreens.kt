package com.nosotros.app.ui

import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nosotros.app.R

/** Primera vez, si la APK no trae la URL y la clave de Supabase. */
@Composable
fun SetupScreen(vm: MainViewModel, ui: UiState) {
    val context = LocalContext.current
    var url by rememberSaveable { mutableStateOf("") }
    var key by rememberSaveable { mutableStateOf("") }

    ScreenColumn {
        Header("Bienvenidos a Nosotros", "Su álbum privado, en la pantalla de inicio de los dos.")

        Text("¿Tu pareja ya lo configuró?", style = MaterialTheme.typography.titleMedium)
        Text(
            "Pídele que toque «Compartir invitación», copia el mensaje que te mande y pégalo aquí.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Button(
            onClick = { clipboardText(context)?.let(vm::useInvitation) ?: vm.useInvitationMissing() },
            enabled = !ui.busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Pegar invitación") }

        HorizontalDivider(Modifier.padding(vertical = 8.dp))

        Text("¿Eres el primero?", style = MaterialTheme.typography.titleMedium)
        Text(
            "Pega la URL y la clave pública (anon / publishable) de su proyecto de Supabase. " +
                "Están en Project Settings → API. Los pasos completos, en SETUP.md.",
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedTextField(
            value = url,
            onValueChange = { url = it.trim() },
            label = { Text("URL del proyecto") },
            placeholder = { Text("https://xxxx.supabase.co") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = key,
            onValueChange = { key = it.trim() },
            label = { Text("Clave pública") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { vm.saveConfig(url, key) },
            enabled = !ui.busy && url.isNotBlank() && key.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Guardar y continuar") }

        BusyIndicator(ui.busy)
    }
    MessageDialog(ui.message, vm::dismissMessage)
}

/** Crear un álbum o unirse con el código de la pareja. */
@Composable
fun PairingScreen(vm: MainViewModel, ui: UiState) {
    val context = LocalContext.current
    var code by rememberSaveable { mutableStateOf("") }

    ScreenColumn {
        Header("Emparéjense", "Uno crea el álbum y el otro se une con el código de 6 caracteres.")

        Button(onClick = vm::createAlbum, enabled = !ui.busy, modifier = Modifier.fillMaxWidth()) {
            Text("Crear nuestro álbum")
        }

        HorizontalDivider(Modifier.padding(vertical = 8.dp))

        Text("¿Tu pareja ya lo creó?", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = code,
            onValueChange = { input ->
                code = input.uppercase().filter { it.isLetterOrDigit() }.take(6)
            },
            label = { Text("Código") },
            singleLine = true,
            textStyle = MaterialTheme.typography.headlineSmall.copy(
                fontFamily = FontFamily.Monospace,
                letterSpacing = 6.sp,
                textAlign = TextAlign.Center,
            ),
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                keyboardType = KeyboardType.Ascii,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = { clipboardText(context)?.let(vm::useInvitation) ?: vm.useInvitationMissing() },
                enabled = !ui.busy,
                modifier = Modifier.weight(1f),
            ) { Text("Pegar invitación") }
            Button(
                onClick = { vm.joinAlbum(code) },
                enabled = !ui.busy && code.length == 6,
                modifier = Modifier.weight(1f),
            ) { Text("Unirme") }
        }

        BusyIndicator(ui.busy)
    }
    MessageDialog(ui.message, vm::dismissMessage)
}

@Composable
private fun ScreenColumn(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) { content() }
}

@Composable
private fun Header(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            painter = painterResource(R.drawable.ic_heart),
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(56.dp),
        )
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        Text(
            subtitle,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun BusyIndicator(busy: Boolean) {
    if (busy) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            CircularProgressIndicator(Modifier.size(32.dp))
        }
    }
}

@Composable
fun MessageDialog(message: String?, onDismiss: () -> Unit) {
    if (message == null) return
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Entendido") } },
        text = { Text(message) },
    )
}

fun clipboardText(context: Context): String? {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = clipboard.primaryClip ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0).coerceToText(context)?.toString()?.takeIf { it.isNotBlank() }
}
