import sys, os
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_here))  # project root (prompt_generator.py)
sys.path.insert(0, _here)                   # api/ dir (_utils.py)

from _utils import BaseHandler
from prompt_generator import PROVIDERS


class handler(BaseHandler):
    def do_GET(self):
        self._json(200, PROVIDERS)
