import ast
from pathlib import Path
import unittest


class TestBotIdentity(unittest.TestCase):
    def test_expected_bot_is_checked_by_id_and_case_insensitive_username(self):
        tree = ast.parse(Path(__file__).with_name('install-miniapp-shared-preorder.py').read_text())
        function = next(x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name == 'is_expected_test_bot')
        namespace = {}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'bot-identity', 'exec'), namespace)
        check = namespace['is_expected_test_bot']
        self.assertTrue(check({'id': 572898079, 'username': 'Exgorod_bot'}))
        self.assertTrue(check({'id': 572898079, 'username': 'exgorod_bot'}))
        self.assertFalse(check({'id': 1, 'username': 'Exgorod_bot'}))
        self.assertFalse(check({'id': 572898079, 'username': 'different_bot'}))


if __name__ == '__main__':
    unittest.main()
