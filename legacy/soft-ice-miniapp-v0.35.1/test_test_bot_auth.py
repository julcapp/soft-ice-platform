import ast, hashlib, hmac, json, pathlib, time, unittest
from urllib.parse import parse_qsl, urlencode
source=pathlib.Path(__file__).with_name('server.py').read_text()
names={'validate_webapp_init_data','validate_telegram_init_data','webapp_identity'}
functions=[node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef) and node.name in names]
def fixture():
 env=dict(hmac=hmac,hashlib=hashlib,json=json,time=time,parse_qsl=parse_qsl,TELEGRAM_AUTH_MAX_AGE=300,TELEGRAM_BOT_TOKEN='primary-token',TELEGRAM_TEST_BOT_TOKEN='test-token',TELEGRAM_TEST_ALLOWED_USER_IDS={'93614095'},DEMO_MODE=False)
 exec(compile(ast.Module(body=functions,type_ignores=[]),'auth-test','exec'),env)
 return env

def signed(token,uid=93614095,age=0):
 values={'auth_date':str(int(time.time())-age),'user':json.dumps({'id':uid})}
 key=hmac.new(b'WebAppData',token.encode(),hashlib.sha256).digest()
 values['hash']=hmac.new(key,'\n'.join(f'{k}={values[k]}' for k in sorted(values)).encode(),hashlib.sha256).hexdigest()
 return urlencode(values)
class Tests(unittest.TestCase):
 def test_primary_unchanged(self):self.assertEqual(fixture()['webapp_identity']('telegram',signed('primary-token',123))[0]['id'],123)
 def test_allowlisted_test_identity(self):self.assertEqual(fixture()['webapp_identity']('telegram',signed('test-token'))[0]['id'],93614095)
 def test_test_denied_other_user(self):
  with self.assertRaises(ValueError):fixture()['webapp_identity']('telegram',signed('test-token',123))
 def test_invalid_and_expired_rejected(self):
  for data in [signed('wrong-token'),signed('test-token',age=1000),signed('primary-token',age=1000),'']:
   with self.assertRaises(ValueError):fixture()['webapp_identity']('telegram',data)
 def test_empty_allowlist_fails_closed(self):
  env=fixture();env['TELEGRAM_TEST_ALLOWED_USER_IDS']=set()
  with self.assertRaises(ValueError):env['webapp_identity']('telegram',signed('test-token'))
if __name__=='__main__':unittest.main()
