package dev.kian.gymapp

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.PermissionController

class MaisHealthPermissionActivity : ComponentActivity() {
    companion object {
        const val EXTRA_PERMISSIONS = "mais.health.permissions"
        const val EXTRA_GRANTED_PERMISSIONS = "mais.health.granted_permissions"
    }

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { grantedPermissions ->
        val result = Intent().putStringArrayListExtra(
            EXTRA_GRANTED_PERMISSIONS,
            ArrayList(grantedPermissions.sorted())
        )
        setResult(Activity.RESULT_OK, result)
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val requested = intent.getStringArrayListExtra(EXTRA_PERMISSIONS)?.toSet().orEmpty()
        if (requested.isEmpty()) {
            setResult(Activity.RESULT_CANCELED)
            finish()
            return
        }
        permissionLauncher.launch(requested)
    }
}
