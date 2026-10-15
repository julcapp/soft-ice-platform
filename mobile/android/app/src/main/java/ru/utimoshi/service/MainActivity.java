package ru.utimoshi.service;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.view.WindowManager;
import android.widget.*;
import android.text.InputType;
import org.json.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout page;
    private TextView message;
    private ServiceApi api;
    private DeviceKey key;
    private JSONArray roles;
    private boolean busy;
    private int generation;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        try { key = new DeviceKey(); api = new ServiceApi(key); loginScreen(); }
        catch (Exception e) { layout("Не удалось подготовить смартфон"); text("Закройте приложение и попробуйте снова."); }
    }
    private void layout(String title) {
        generation++;
        ScrollView scroll = new ScrollView(this); page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL); page.setPadding(32,48,32,32);
        scroll.addView(page); setContentView(scroll);
        TextView heading = text(title); heading.setTextSize(25);
        message = text("");
    }
    private TextView text(String value) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(18); view.setPadding(0,12,0,12); page.addView(view); return view;
    }
    private void button(String label, Runnable action) {
        Button button = new Button(this); button.setText(label); page.addView(button);
        button.setOnClickListener(v -> { if (!busy) action.run(); });
    }
    private EditText field(String hint, int type) {
        EditText input = new EditText(this); input.setHint(hint); input.setInputType(type); input.setSingleLine(true); page.addView(input); return input;
    }
    private void loginScreen() {
        layout("У Тимоши · Сервис");
        text("Войдите в учётную запись сотрудника");
        EditText login = field("Логин", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        EditText password = field("Пароль", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setSaveEnabled(false);
        CheckBox show = new CheckBox(this); show.setText("Показать пароль"); page.addView(show);
        show.setOnCheckedChangeListener((v, checked) -> { password.setInputType(InputType.TYPE_CLASS_TEXT | (checked ? InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD : InputType.TYPE_TEXT_VARIATION_PASSWORD)); password.setSelection(password.length()); });
        button("Войти", () -> {
            String name = login.getText().toString().trim(); String secret = password.getText().toString();
            if (name.isEmpty() || secret.length() < 9 || secret.length() > 128) { message.setText("Введите логин и пароль от 9 до 128 знаков."); return; }
            password.setText("");
            task(() -> api.login(name,secret), result -> { roles = result.getJSONArray("roles"); roleScreen(); });
        });
        button("Подготовить привязку смартфона", this::registration);
    }
    private void registration() {
        layout("Привязка смартфона");
        text("Перед первым входом администратор регистрирует этот смартфон для сотрудника. При замене телефона прежняя привязка отзывается.");
        button("Передать данные администратору", () -> {
            try {
                JSONObject data = new JSONObject().put("manufacturer",Build.MANUFACTURER).put("model",Build.MODEL).put("androidVersion",Build.VERSION.RELEASE).put("appVersion","0.1.0").put("publicKey",key.publicKey());
                Intent share = new Intent(Intent.ACTION_SEND); share.setType("text/plain"); share.putExtra(Intent.EXTRA_TEXT,data.toString(2));
                startActivity(Intent.createChooser(share,"Передать данные смартфона"));
            } catch (Exception e) { message.setText("Не удалось подготовить данные смартфона."); }
        });
        button("Назад ко входу",this::loginScreen);
    }
    private String roleName(String role) { return "SERVICE_SPECIALIST".equals(role) ? "Техник" : "Мастер"; }
    private void roleScreen() throws JSONException {
        layout("Выберите роль");
        for (int i=0;i<roles.length();i++) {
            String role = roles.getString(i);
            if (!role.equals("SERVICE_SPECIALIST") && !role.equals("MACHINE_RESPONSIBLE")) continue;
            button(roleName(role), () -> task(() -> api.signed("POST","/api/v1/mobile-service/role",new JSONObject().put("role",role)), result -> loadMachines(role)));
        }
        button("Выйти",this::logout);
    }
    private void loadMachines(String role) {
        task(() -> api.signed("GET","/api/v1/mobile-service/workspace",null), result -> {
            layout(roleName(role)+" · Аппараты");
            JSONArray machines = result.getJSONArray("machines");
            if (machines.length()==0) text("Для этой роли пока нет назначенных аппаратов.");
            for (int i=0;i<machines.length();i++) {
                JSONObject machine = machines.getJSONObject(i);
                text(machine.optString("machineCode")+" · "+machine.optString("name")+"\n"+machine.optString("location",""));
            }
            button("Обновить", () -> loadMachines(role));
            button("Сменить роль", () -> { try { roleScreen(); } catch (Exception e) { message.setText("Не удалось открыть выбор роли."); } });
            button("Выйти",this::logout);
        });
    }
    private void logout() {
        task(() -> api.signed("POST","/api/v1/mobile-service/logout",new JSONObject()), result -> { api.clear(); roles=null; loginScreen(); });
    }
    interface Operation { JSONObject run() throws Exception; }
    interface Success { void run(JSONObject result) throws Exception; }
    private void task(Operation operation, Success success) {
        if (busy) return; busy=true; int screen=generation; message.setText("Подождите…");
        worker.execute(() -> {
            try {
                JSONObject result=operation.run();
                runOnUiThread(() -> { busy=false; if (isDestroyed() || screen!=generation) return; message.setText(""); try { success.run(result); } catch (Exception e) { message.setText("Не удалось прочитать ответ сервера."); } });
            } catch (Exception e) {
                runOnUiThread(() -> { busy=false; if (!isDestroyed() && screen==generation) message.setText(e instanceof java.io.IOException ? "Нет связи с сервером. Проверьте интернет." : e.getMessage()); });
            }
        });
    }
    @Override protected void onDestroy() { generation++; if (api!=null) api.clear(); worker.shutdownNow(); super.onDestroy(); }
}
