package ru.utimoshi.service;

import org.json.JSONObject;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.security.MessageDigest;

final class ServiceApi {
    private static final String BASE = "https://admin.utimoshi.ru";
    private final DeviceKey key;
    private String token;
    ServiceApi(DeviceKey key) { this.key = key; }
    JSONObject login(String login, String password) throws Exception {
        JSONObject result = request("POST", "/api/v1/mobile-service/login", new JSONObject().put("login", login).put("password", password).toString().getBytes(StandardCharsets.UTF_8), null);
        token = result.getString("token"); return result;
    }
    JSONObject signed(String method, String path, JSONObject body) throws Exception {
        byte[] bytes = body == null ? new byte[0] : body.toString().getBytes(StandardCharsets.UTF_8);
        JSONObject challengeBody = new JSONObject().put("method", method).put("path", path).put("bodyHash", hash(bytes));
        JSONObject challenge = request("POST", "/api/v1/mobile-service/challenge", challengeBody.toString().getBytes(StandardCharsets.UTF_8), null);
        // Build the protocol payload locally; never sign arbitrary server text.
        String payload = "softice-service-device-v1\n" + challenge.getString("challengeId") + "\n" + challenge.getString("nonce");
        JSONObject proof = new JSONObject().put("challengeId", challenge.getString("challengeId")).put("nonce", challenge.getString("nonce")).put("signature", key.sign(payload));
        return request(method, path, bytes, proof);
    }
    void clear() { token = null; }
    private JSONObject request(String method, String path, byte[] bytes, JSONObject proof) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(BASE + path).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
        connection.setRequestMethod(method); connection.setRequestProperty("Accept", "application/json");
        if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
        if (proof != null) {
            connection.setRequestProperty("X-Device-Challenge", proof.getString("challengeId"));
            connection.setRequestProperty("X-Device-Nonce", proof.getString("nonce"));
            connection.setRequestProperty("X-Device-Signature", proof.getString("signature"));
        }
        try {
            if (!method.equals("GET")) {
                connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                try (java.io.OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            }
            int status = connection.getResponseCode();
            InputStream input = status < 400 ? connection.getInputStream() : connection.getErrorStream();
            if (input == null) throw new Exception("Сервер временно недоступен.");
            String text;
            try (InputStream stream = input) { java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int n; while ((n = stream.read(buffer)) != -1) { if (out.size() + n > 1048576) throw new java.io.IOException("Ответ сервера слишком большой."); out.write(buffer, 0, n); } text = new String(out.toByteArray(), StandardCharsets.UTF_8); }
            JSONObject response = new JSONObject(text);
            if (status >= 400) {
                JSONObject error = response.optJSONObject("error");
                throw new Exception(error == null ? "Ошибка сервера. Повторите позже." : error.optString("message", "Доступ отклонён."));
            }
            return response.getJSONObject("data");
        } finally { connection.disconnect(); }
    }
    private static String hash(byte[] bytes) throws Exception {
        StringBuilder result = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }
}
