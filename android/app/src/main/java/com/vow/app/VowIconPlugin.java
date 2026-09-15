package com.vow.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "VowIcon")
public class VowIconPlugin extends Plugin {
    private static final String[] COLOURS = {"white", "black", "gold", "blue"};

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
            pm.setComponentEnabledSetting(component,
                    value.equals(colour) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
        }

        JSObject result = new JSObject();
        result.put("colour", colour);
        call.resolve(result);
    }
}
