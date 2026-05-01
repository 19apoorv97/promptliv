import sys, os
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_here))
sys.path.insert(0, _here)

from _utils import BaseHandler, resolve_provider
from prompt_generator import run_improve


class handler(BaseHandler):
    def do_POST(self):
        try:
            body = self._read_body()
            provider, model = resolve_provider(body)
            result = run_improve(
                provider, model, body["prompt"],
                feedback=body.get("feedback", ""),
                context=body.get("context", ""), silent=True,
            )
            self._json(200, {"result": result})
        except Exception as e:
            self._json(500, {"detail": str(e)})
