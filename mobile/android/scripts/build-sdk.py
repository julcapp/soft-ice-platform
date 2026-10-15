"""Reproducible test APK build using JDK 17 and Android SDK 35/build-tools 34."""
import os, pathlib, subprocess, shutil, xml.etree.ElementTree as ET, zipfile
root=pathlib.Path(__file__).resolve().parent.parent
sdk=pathlib.Path(os.environ['ANDROID_HOME'])
tools=sdk/'build-tools/34.0.0'
android=sdk/'platforms/android-35/android.jar'
out=root/'app/build/sdk'
if out.exists(): shutil.rmtree(out)
(out/'classes').mkdir(parents=True);(out/'dex').mkdir()
def run(args):subprocess.run([str(a) for a in args],check=True)
run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','--release','8','-cp',android,'-d',out/'classes',*sorted((root/'app/src/main/java').rglob('*.java'))])
run(['java','-m','jdk.jartool/sun.tools.jar.Main','cf',out/'classes.jar','-C',out/'classes','.'])
run([tools/'d8','--lib',android,'--min-api','26','--output',out/'dex',out/'classes.jar'])
ns='http://schemas.android.com/apk/res/android';ET.register_namespace('android',ns)
tree=ET.parse(root/'app/src/main/AndroidManifest.xml');m=tree.getroot()
m.set('package','ru.utimoshi.service');m.set('{'+ns+'}versionCode','1');m.set('{'+ns+'}versionName','0.1.0')
ET.SubElement(m,'uses-sdk',{'{'+ns+'}minSdkVersion':'26','{'+ns+'}targetSdkVersion':'35'})
tree.write(out/'AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
run([tools/'aapt','package','-f','-M',out/'AndroidManifest.xml','-I',android,'-F',out/'unsigned.apk'])
with zipfile.ZipFile(out/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(out/'dex/classes.dex','classes.dex')
run([tools/'zipalign','-f','4',out/'unsigned.apk',out/'aligned.apk'])
key=pathlib.Path(os.environ['SOFTICE_DEBUG_KEYSTORE'])
if not key.exists():
 key.parent.mkdir(parents=True,exist_ok=True)
 run(['keytool','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Android Debug','-keyalg','RSA','-keysize','2048','-validity','3650'])
apk=out/'utimoshi-service-0.1.0-debug.apk'
run([tools/'apksigner','sign','--ks',key,'--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android','--out',apk,out/'aligned.apk'])
run([tools/'apksigner','verify','--verbose',apk]);run([tools/'aapt','dump','badging',apk])
print('APK:',apk)
