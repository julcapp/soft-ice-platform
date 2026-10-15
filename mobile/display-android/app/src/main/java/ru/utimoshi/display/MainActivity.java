package ru.utimoshi.display;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.util.Arrays;

public final class MainActivity extends Activity {
 private static final int CAMERA_REQUEST=41;
 private WebView web;
 private LinearLayout errorPanel;
 private TextView errorText,caption;
 private ProgressBar progress;
 private SharedPreferences preferences;
 private PermissionRequest cameraRequest;
 private String machine;
 private boolean demo,permissionDialog;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  preferences=getSharedPreferences("display-settings",MODE_PRIVATE);
  machine=preferences.getString("machine",WebNavigationPolicy.DEFAULT_MACHINE);
  demo=preferences.getBoolean("demo",false);
  try{WebNavigationPolicy.machine(machine);}catch(Exception e){machine=WebNavigationPolicy.DEFAULT_MACHINE;}
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(248,244,238));
  if(Build.VERSION.SDK_INT>=30){root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());android.graphics.Insets ime=insets.getInsets(WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));return WindowInsets.CONSUMED;});}else root.setFitsSystemWindows(true);
  LinearLayout toolbar=new LinearLayout(this);toolbar.setPadding(dp(6),0,dp(6),0);toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
  Button back=new Button(this);back.setText("‹");back.setContentDescription("Назад");back.setOnClickListener(v->goBack());toolbar.addView(back,new LinearLayout.LayoutParams(dp(52),dp(48)));
  caption=new TextView(this);caption.setTextColor(Color.rgb(30,66,48));caption.setTextSize(14);toolbar.addView(caption,new LinearLayout.LayoutParams(0,dp(48),1));caption.setGravity(android.view.Gravity.CENTER_VERTICAL);
  Button menu=new Button(this);menu.setText("⋮");menu.setContentDescription("Меню приложения");menu.setOnClickListener(v->showMenu());toolbar.addView(menu,new LinearLayout.LayoutParams(dp(52),dp(48)));root.addView(toolbar);
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);root.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
  FrameLayout content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
  web=new WebView(this);content.addView(web,new FrameLayout.LayoutParams(-1,-1));
  errorPanel=new LinearLayout(this);errorPanel.setOrientation(LinearLayout.VERTICAL);errorPanel.setPadding(dp(24),dp(24),dp(24),dp(24));errorPanel.setBackgroundColor(Color.rgb(248,244,238));errorPanel.setGravity(android.view.Gravity.CENTER);
  errorText=new TextView(this);errorText.setTextSize(20);errorText.setTextColor(Color.DKGRAY);errorPanel.addView(errorText);
  Button retry=new Button(this);retry.setText("Повторить загрузку");retry.setOnClickListener(v->{errorPanel.setVisibility(View.GONE);if(web.getUrl()==null)loadStart();else web.reload();});errorPanel.addView(retry);
  Button browser=new Button(this);browser.setText("Открыть сайт в браузере");browser.setOnClickListener(v->openBrowser(WebNavigationPolicy.startUrl(machine,demo)));errorPanel.addView(browser);
  content.addView(errorPanel,new FrameLayout.LayoutParams(-1,-1));errorPanel.setVisibility(View.GONE);setContentView(root);
  WebView.setWebContentsDebuggingEnabled(false);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setSupportZoom(true);settings.setBuiltInZoomControls(true);settings.setDisplayZoomControls(false);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(true);settings.setMediaPlaybackRequiresUserGesture(true);
  if(Build.VERSION.SDK_INT>=26)settings.setSafeBrowsingEnabled(true);
  settings.setUserAgentString(settings.getUserAgentString()+" UtimoshiDisplay/0.1.0");
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){return r.isForMainFrame()?route(r.getUrl().toString(),r.hasGesture()):!"https".equalsIgnoreCase(r.getUrl().getScheme());}
   @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return route(url,true);}
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){progress.setVisibility(View.VISIBLE);errorPanel.setVisibility(View.GONE);denyPendingCamera();}
   @Override public void onPageFinished(WebView view,String url){progress.setVisibility(View.GONE);CookieManager.getInstance().flush();}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showError("Не удалось загрузить страницу. Проверьте интернет и повторите загрузку. Заказы и оплаты проверяются сервером.");}
   @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=400)showError("Сервер временно недоступен ("+response.getStatusCode()+"). Повторите позже.");}
   @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){handler.cancel();showError("Не удалось проверить защищённое соединение. Проверьте дату устройства и интернет. Продолжение с ошибкой сертификата запрещено.");}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);}
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->handleCamera(request));}
   @Override public void onPermissionRequestCanceled(PermissionRequest request){if(cameraRequest==request)cameraRequest=null;}
   @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean userGesture,android.os.Message message){
    if(!userGesture)return false;
    WebView temporary=new WebView(MainActivity.this);
    temporary.setWebViewClient(new WebViewClient(){private boolean handled;private void forward(String url){if(handled||"about:blank".equals(url))return;handled=true;if(!route(url,true))web.loadUrl(url);temporary.stopLoading();temporary.destroy();}
     @Override public boolean shouldOverrideUrlLoading(WebView v,String url){forward(url);return true;}
     @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){forward(url);}
     @Override public void onReceivedSslError(WebView v,SslErrorHandler h,SslError e){h.cancel();}
    });
    ((WebView.WebViewTransport)message.obj).setWebView(temporary);message.sendToTarget();return true;
   }
  });
  web.setDownloadListener((url,userAgent,disposition,mime,size)->{if(WebNavigationPolicy.classify(url)!=WebNavigationPolicy.Kind.BLOCKED)openBrowser(url);});
  updateCaption();if(state==null||web.restoreState(state)==null)loadStart();
 }
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private void updateCaption(){caption.setText("У Тимоши · "+(demo?"Демонстрация":machine));}
 private void loadStart(){errorPanel.setVisibility(View.GONE);web.loadUrl(WebNavigationPolicy.startUrl(machine,demo));}
 private void showError(String message){progress.setVisibility(View.GONE);errorText.setText(message);errorPanel.setVisibility(View.VISIBLE);}
 private boolean route(String url,boolean gesture){
  WebNavigationPolicy.Kind kind=WebNavigationPolicy.classify(url);
  if(kind==WebNavigationPolicy.Kind.DISPLAY||kind==WebNavigationPolicy.Kind.PAYMENT)return false;
  if(kind==WebNavigationPolicy.Kind.EXTERNAL){openBrowser(url);return true;}
  if(url.startsWith("intent:")&&gesture){try{Intent intent=Intent.parseUri(url,Intent.URI_INTENT_SCHEME);String fallback=intent.getStringExtra("browser_fallback_url");if(WebNavigationPolicy.classify(fallback)!=WebNavigationPolicy.Kind.BLOCKED){openBrowser(fallback);return true;}}catch(Exception ignored){}}
  Toast.makeText(this,"Эта ссылка не поддерживается. Используйте открытие сайта в браузере.",Toast.LENGTH_LONG).show();return true;
 }
 private void openBrowser(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE));}catch(Exception e){Toast.makeText(this,"Не найден браузер для открытия ссылки.",Toast.LENGTH_LONG).show();}}
 private void handleCamera(PermissionRequest request){
  if(!WebNavigationPolicy.cameraAllowed(request.getOrigin().toString(),web.getUrl())||request.getResources().length!=1||!Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)){request.deny();return;}
  denyPendingCamera();cameraRequest=request;
  if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)grantCamera();else{permissionDialog=true;requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_REQUEST);}
 }
 private void grantCamera(){PermissionRequest request=cameraRequest;cameraRequest=null;if(request==null)return;if(WebNavigationPolicy.cameraAllowed(request.getOrigin().toString(),web.getUrl()))request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else request.deny();}
 private void denyPendingCamera(){if(cameraRequest!=null){cameraRequest.deny();cameraRequest=null;}}
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){super.onRequestPermissionsResult(requestCode,permissions,results);if(requestCode==CAMERA_REQUEST){permissionDialog=false;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)grantCamera();else{denyPendingCamera();Toast.makeText(this,"Камера недоступна. Код заказа можно ввести вручную.",Toast.LENGTH_LONG).show();}}}
 private void showMenu(){new AlertDialog.Builder(this).setTitle("У Тимоши · Экран 0.1.0").setItems(new String[]{"Перезагрузить страницу","Настроить аппарат","Открыть рабочий экран","Открыть демонстрацию","Открыть сайт в браузере"},(dialog,index)->{
  if(index==0)web.reload();else if(index==1)settings();else if(index==2||index==3)new AlertDialog.Builder(this).setMessage("Перейти на другой экран? Это не отменит уже созданные на сервере заказы.").setNegativeButton("Остаться",null).setPositiveButton("Перейти",(d,w)->{demo=index==3;preferences.edit().putBoolean("demo",demo).apply();updateCaption();loadStart();}).show();else openBrowser(WebNavigationPolicy.startUrl(machine,demo));
 }).show();}
 private void settings(){EditText input=new EditText(this);input.setSingleLine(true);input.setText(machine);input.setSelectAllOnFocus(true);AlertDialog dialog=new AlertDialog.Builder(this).setTitle("ID аппарата").setMessage("По умолчанию — TEST-MACHINE-001. ID выбирает аппарат, но не выдаёт серверных прав доступа.").setView(input).setNegativeButton("Отмена",null).setPositiveButton("Сохранить",null).create();dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{machine=WebNavigationPolicy.machine(input.getText().toString().trim());preferences.edit().putString("machine",machine).apply();demo=false;preferences.edit().putBoolean("demo",false).apply();updateCaption();loadStart();dialog.dismiss();}catch(Exception e){input.setError(e.getMessage());}}));dialog.show();}
 private void goBack(){if(web.canGoBack()){web.goBack();return;}new AlertDialog.Builder(this).setMessage("Закрыть приложение? Статусы заказов сохраняются на сервере.").setNegativeButton("Остаться",null).setPositiveButton("Закрыть",(d,w)->finish()).show();}
 @Override public void onBackPressed(){goBack();}
 @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
 @Override protected void onPause(){if(!permissionDialog)denyPendingCamera();web.onPause();super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){denyPendingCamera();if(web!=null){web.stopLoading();web.setWebChromeClient(null);web.setWebViewClient(null);((android.view.ViewGroup)web.getParent()).removeView(web);web.destroy();}super.onDestroy();}
}
