package ru.utimoshi.display;
import java.net.URI;
import java.util.Locale;
public final class WebNavigationPolicy {
 public enum Kind { DISPLAY, PAYMENT, EXTERNAL, BLOCKED }
 public static final String DEFAULT_MACHINE="TEST-MACHINE-001";
 public static Kind classify(String value){
  try { URI u=new URI(value);String h=u.getHost();
   if(!"https".equalsIgnoreCase(u.getScheme())||h==null||u.getRawUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443))return Kind.BLOCKED;
   h=h.toLowerCase(Locale.ROOT);
   if(h.equals("display.utimoshi.ru"))return Kind.DISPLAY;
   if(domain(h,"yookassa.ru")||domain(h,"yoomoney.ru"))return Kind.PAYMENT;
   return Kind.EXTERNAL;
  }catch(Exception e){return Kind.BLOCKED;}
 }
 private static boolean domain(String host,String base){return host.equals(base)||host.endsWith("."+base);}
 public static String machine(String id){if(id==null||!id.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,63}"))throw new IllegalArgumentException("Укажите корректный ID аппарата.");return id;}
 public static String startUrl(String id,boolean demo){return demo?"https://display.utimoshi.ru/api/supplier-demo/":"https://display.utimoshi.ru/?machineId="+machine(id);}
 public static boolean cameraAllowed(String origin,String page){return classify(origin)==Kind.DISPLAY&&classify(page)==Kind.DISPLAY&&!URI.create(page).getPath().startsWith("/api/supplier-demo");}
 private WebNavigationPolicy(){}
}
