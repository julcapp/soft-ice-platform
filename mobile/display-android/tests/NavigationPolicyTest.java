import ru.utimoshi.display.WebNavigationPolicy;
import static ru.utimoshi.display.WebNavigationPolicy.Kind.*;
public class NavigationPolicyTest{
 static void check(boolean b){if(!b)throw new AssertionError();}
 public static void main(String[] args){
  check(WebNavigationPolicy.classify("https://display.utimoshi.ru/?machineId=TEST-MACHINE-001")==DISPLAY);
  check(WebNavigationPolicy.classify("https://yoomoney.ru/checkout/payments/v2/contract")==PAYMENT);
  check(WebNavigationPolicy.classify("https://secure.yookassa.ru/payment")==PAYMENT);
  for(String u:new String[]{"https://display.utimoshi.ru.evil.test/","https://evil.test/yookassa.ru","https://fake-yookassa.ru/"})check(WebNavigationPolicy.classify(u)==EXTERNAL);
  for(String u:new String[]{"http://display.utimoshi.ru/","javascript:alert(1)","file:///etc/passwd","https://user@display.utimoshi.ru/","https://display.utimoshi.ru:8443/",null})check(WebNavigationPolicy.classify(u)==BLOCKED);
  check(WebNavigationPolicy.cameraAllowed("https://display.utimoshi.ru","https://display.utimoshi.ru/?machineId=TEST-MACHINE-001"));
  check(!WebNavigationPolicy.cameraAllowed("https://yoomoney.ru","https://display.utimoshi.ru/"));
  check(!WebNavigationPolicy.cameraAllowed("https://display.utimoshi.ru","https://display.utimoshi.ru/api/supplier-demo/"));
  check(WebNavigationPolicy.startUrl("TEST-MACHINE-001",false).equals("https://display.utimoshi.ru/?machineId=TEST-MACHINE-001"));
  for(String id:new String[]{"../admin","x&machineId=1","","x y"}){boolean rejected=false;try{WebNavigationPolicy.machine(id);}catch(IllegalArgumentException e){rejected=true;}check(rejected);}
  System.out.println("Navigation policy: all checks passed");
 }
}
