package ru.utimoshi.service;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;

final class DeviceKey {
    private static final String ALIAS = "utimoshi_service_device_v1";
    private final KeyStore store;
    DeviceKey() throws Exception {
        store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256).build());
            generator.generateKeyPair();
        }
    }
    String publicKey() throws Exception {
        return "-----BEGIN PUBLIC KEY-----\n" + Base64.encodeToString(store.getCertificate(ALIAS).getPublicKey().getEncoded(), Base64.NO_WRAP) + "\n-----END PUBLIC KEY-----";
    }
    String sign(String payload) throws Exception {
        Signature signature = Signature.getInstance("SHA256withECDSA");
        signature.initSign((PrivateKey) store.getKey(ALIAS, null));
        signature.update(payload.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP);
    }
}
