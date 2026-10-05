import unittest
from app import redact

class RedactionTests(unittest.TestCase):
    def test_long_value_is_redacted(self):
        value = 'ghp_abcdefghijklmnopqrstuvwxyz123456'
        self.assertNotEqual(redact(value), value)
        self.assertIn('…', redact(value))

    def test_short_value_is_fully_redacted(self):
        self.assertEqual(redact('short'), '[REDACTED]')

if __name__ == '__main__':
    unittest.main()
