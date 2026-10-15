import ast
from pathlib import Path
import unittest
from urllib.parse import urlparse
import json


class SharedPreorderRoutesTest(unittest.TestCase):
    def setUp(self):
        # Load actual routing methods without initializing the legacy JSON database.
        tree = ast.parse(Path(__file__).with_name('server.py').read_text())
        assigns = [x for x in tree.body if isinstance(x, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id in {'PUBLIC_GET_ROUTES', 'PUBLIC_POST_ROUTES'} for t in x.targets)]
        handler = next(x for x in tree.body if isinstance(x, ast.ClassDef) and x.name == 'Handler')
        methods = [x for x in handler.body if isinstance(x, ast.FunctionDef) and x.name in {'do_GET', 'do_POST'}]
        class Base:
            def do_GET(self):
                self.served = self.path
        namespace = {'Base': Base, 'urlparse': urlparse, 'json': json,
                     'request_preorder': lambda path, payload: {'path': path, 'payload': payload}}
        candidate = ast.Module(body=assigns + [ast.ClassDef(name='Routes', bases=[ast.Name(id='Base', ctx=ast.Load())],
            keywords=[], body=methods, decorator_list=[])], type_ignores=[])
        exec(compile(ast.fix_missing_locations(candidate), 'actual-router', 'exec'), namespace)
        self.instance = namespace['Routes']()
        self.instance.json_response = lambda status, value: setattr(self.instance, 'response', (status, value))

    def test_new_static_files_are_served_but_arbitrary_files_remain_denied(self):
        for path in ['/preorder-test.html', '/preorder-test.js']:
            self.instance.path = path
            self.instance.do_GET()
            self.assertEqual(self.instance.served, path)
        self.instance.path = '/server.py'
        self.instance.do_GET()
        self.assertEqual(self.instance.response[0], 404)

    def test_shared_post_reaches_proxy_with_signature_payload(self):
        self.instance.path = '/api/tma/shared-preorder/catalog'
        self.instance.read_json = lambda: {'init_data': 'signed-test-value'}
        self.instance.do_POST()
        self.assertEqual(self.instance.response, (200, {'path': 'catalog', 'payload': {'init_data': 'signed-test-value'}}))

    def test_unrelated_post_is_not_opened(self):
        self.instance.path = '/api/private/new-operation'
        self.instance.read_json = lambda: {}
        self.instance.do_POST()
        self.assertEqual(self.instance.response[0], 404)


if __name__ == '__main__':
    unittest.main()
