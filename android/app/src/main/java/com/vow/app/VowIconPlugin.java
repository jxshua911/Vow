package com.vow.app;

import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Build;

import androidx.annotation.RequiresApi;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "VowIcon")
public class VowIconPlugin extends Plugin {
    private static final String[] COLOURS = {"white", "black", "gold", "blue"};
    private static final String CUSTOM_SHORTCUT_ID = "vow-custom-icon";

    @PluginMethod
    public void setColour(PluginCall call) {
        String colour = call.getString("colour", "white").toLowerCase();
        boolean valid = false;
        for (String value : COLOURS) if (value.equals(colour)) valid = true;
        if (!valid) {
            call.reject("Unsupported VOW icon colour");
            return;
        }

        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        String packageName = context.getPackageName();

        for (String value : COLOURS) {
            ComponentName component = new ComponentName(packageName, packageName + "." + value + "IconAlias");
            pm.setComponentEnabledSetting(
                    component,
                    value.equals(colour)
                            ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                            : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
            );
        }

        ShortcutManagerCompat.removeDynamicShortcuts(context, java.util.Collections.singletonList(CUSTOM_SHORTCUT_ID));

        JSObject result = new JSObject();
        result.put("colour", colour);
        call.resolve(result);
    }

    @PluginMethod
    public void setCustom(PluginCall call) {
        String background = call.getString("background", "#ffffff");
        String foreground = call.getString("foreground", "#3b82f6");

        if (!isHexColour(background) || !isHexColour(foreground)) {
            call.reject("Invalid VOW icon colour");
            return;
        }

        Context context = getContext();
        Bitmap bitmap = buildIconBitmap(background, foreground);
        IconCompat icon = IconCompat.createWithAdaptiveBitmap(bitmap);

        Intent launchIntent = new Intent(context, com.vow.app.MainActivity.class);
        launchIntent.setAction(Intent.ACTION_MAIN);
        launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, CUSTOM_SHORTCUT_ID)
                .setShortLabel("VOW")
                .setLongLabel("VOW")
                .setIcon(icon)
                .setIntent(launchIntent)
                .build();

        ShortcutManagerCompat.pushDynamicShortcut(context, shortcut);

        JSObject result = new JSObject();
        result.put("background", background);
        result.put("foreground", foreground);
        result.put("shortcut", true);
        call.resolve(result);
    }

    private boolean isHexColour(String value) {
        return value != null && value.matches("^#[0-9a-fA-F]{6}$");
    }

    private Bitmap buildIconBitmap(String background, String foreground) {
        int size = 432;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        Paint backgroundPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        backgroundPaint.setColor(android.graphics.Color.parseColor(background));
        canvas.drawRect(0, 0, size, size, backgroundPaint);

        Paint logoPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        logoPaint.setColor(android.graphics.Color.parseColor(foreground));
        logoPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        logoPaint.setTextSize(300);
        logoPaint.setTextAlign(Paint.Align.CENTER);
        Paint.FontMetrics metrics = logoPaint.getFontMetrics();
        float baseline = size / 2f - (metrics.ascent + metrics.descent) / 2f;
        canvas.drawText(">", size / 2f, baseline, logoPaint);

        return bitmap;
    }
}
