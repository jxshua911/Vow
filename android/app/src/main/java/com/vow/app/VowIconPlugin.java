package com.vow.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VowIcon")
public class VowIconPlugin extends Plugin {
    private static final String[] VARIANTS = {
        "purple-green", "orange-blue", "black-pink", "teal-white", "red-blue",
        "gold-blue", "white-green", "pink-orange", "blue-white", "green-purple",
        "black-red", "purple-gold", "orange-white", "pink-teal", "black-blue",
        "teal-orange", "blue-red", "white-black", "gold-purple", "green-teal"
    };

    @PluginMethod
    public void setVariant(PluginCall call) {
        String variant = call.getString("variant", "white-black").toLowerCase();
        boolean valid = false;
        for (String value : VARIANTS) if (value.equals(variant)) valid = true;
        if (!valid) { call.reject("Unsupported VOW icon variant"); return; }
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        String packageName = context.getPackageName();
        for (String value : VARIANTS) {
            String aliasName = value.replace("-", "") + "IconAlias";
            ComponentName component = new ComponentName(packageName, packageName + "." + aliasName);
            pm.setComponentEnabledSetting(component,
                value.equals(variant) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
        }
        JSObject result = new JSObject(); result.put("variant", variant); call.resolve(result);
    }
}
