import ast
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "app.py"
tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "redact")
module = ast.Module(body=[function], type_ignores=[])
namespace = {}
exec(compile(module, str(SOURCE), "exec"), namespace)
redact = namespace["redact"]

class RedactionTests(unittest.TestCase):
    def test_long_value_is_redacted(self):
        value = "ghp_abcdefghijklmnopqrstuvwxyz123456"
        self.assertNotEqual(redact(value), value)
        self.assertIn("…", redact(value))

    def test_short_value_is_fully_redacted(self):
        self.assertEqual(redact("short"), "[REDACTED]")

if __name__ == "__main__":
    unittest.main()
