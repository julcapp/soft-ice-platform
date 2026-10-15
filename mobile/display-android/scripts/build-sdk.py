"""Build the test-signed universal WebView APK with JDK17 / SDK35 / build-tools34.
No Gradle dependency downloads and no private signing material in the repository.
"""
import os,pathlib,subprocess,shutil,xml.etree.ElementTree as ET,zipfile,hashlib,json
root=pathlib.Path(__file__).resolve().parent.parent
sdk=pathlib.Path(os.environ['ANDROID_HOME']);jdk=pathlib.Path(os.environ['JAVA_HOME']);tools=sdk/'build-tools/34.0.0';android=sdk/'platforms/android-35/android.jar'
out=root/'app/build/sdk'
if out.exists():shutil.rmtree(out)
(out/'classes').mkdir(parents=True);(out/'dex').mkdir()
env=os.environ.copy();env['PATH']=str(jdk/'bin')+os.pathsep+env.get('PATH','')
def run(args):subprocess.run([str(a) for a in args],check=True,env=env)
run([jdk/'bin/javac','--release','8','-cp',android,'-d',out/'classes',*sorted((root/'app/src/main/java').rglob('*.java'))])
run([jdk/'bin/jar','cf',out/'classes.jar','-C',out/'classes','.'])
run([tools/'d8','--lib',android,'--min-api','24','--output',out/'dex',out/'classes.jar'])
ns='http://schemas.android.com/apk/res/android';ET.register_namespace('android',ns)
tree=ET.parse(root/'app/src/main/AndroidManifest.xml');manifest=tree.getroot();manifest.set('package','ru.utimoshi.display');manifest.set('{'+ns+'}versionCode','1');manifest.set('{'+ns+'}versionName','0.1.0')
ET.SubElement(manifest,'uses-sdk',{'{'+ns+'}minSdkVersion':'24','{'+ns+'}targetSdkVersion':'35'});tree.write(out/'AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
run([tools/'aapt','package','-f','-M',out/'AndroidManifest.xml','-S',root/'app/src/main/res','-I',android,'-F',out/'unsigned.apk'])
with zipfile.ZipFile(out/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(out/'dex/classes.dex','classes.dex')
run([tools/'zipalign','-f','4',out/'unsigned.apk',out/'aligned.apk'])
key=pathlib.Path(os.environ['UTIMOSHI_DISPLAY_KEYSTORE'])
if not key.exists():
 key.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 run([jdk/'bin/keytool','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','display-test','-dname','CN=Utimoshi Display Test','-keyalg','RSA','-keysize','2048','-validity','3650'])
 key.chmod(0o600)
apk=out/'utimoshi-display-0.1.0-test.apk'
run([tools/'apksigner','sign','--ks',key,'--ks-key-alias','display-test','--ks-pass','pass:android','--key-pass','pass:android','--out',apk,out/'aligned.apk'])
run([tools/'apksigner','verify','--verbose','--print-certs',apk]);run([tools/'zipalign','-c','4',apk]);run([tools/'aapt','dump','badging',apk]);run([tools/'aapt','dump','permissions',apk])
metadata={'package':'ru.utimoshi.display','versionName':'0.1.0','versionCode':1,'minSdk':24,'targetSdk':35,'nativeLibraries':False,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,'physicalDeviceTested':False,'defaultMachine':'TEST-MACHINE-001'}
(out/'build-info.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n');print('APK_BUILD',json.dumps(metadata));print('APK',apk)
