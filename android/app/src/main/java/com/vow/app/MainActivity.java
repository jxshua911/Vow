package com.vow.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(VowIconPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
