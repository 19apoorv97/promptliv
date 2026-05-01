import sys, os
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_here))
sys.path.insert(0, _here)

from _utils import BaseHandler, resolve_provider
from prompt_generator import get_clarifying_questions


class handler(BaseHandler):
    def do_POST(self):
        try:
            body = self._read_body()
            provider, model = resolve_provider(body)
            questions = get_clarifying_questions(
                provider, model, body["task_or_prompt"], body["mode"]
            )
            self._json(200, {"questions": questions})
        except Exception as e:
            self._json(500, {"detail": str(e)})
