"""A token bucket for the Ask endpoint: requests a minute, for the whole server. It starts full and refills steadily."""
from __future__ import annotations

import time
from typing import Callable


class TokenBucket:
    """Capacity `per_minute`, refilled continuously at `per_minute / 60` a second. `clock` is injectable for tests."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._capacity = float(per_minute)
        self._tokens = float(per_minute)
        self._clock = clock
        self._last = clock()

    def take(self) -> bool:
        """Spend one token. False when the bucket is empty."""
        now = self._clock()
        self._tokens = min(self._capacity, self._tokens + (now - self._last) * self._capacity / 60.0)
        self._last = now
        if self._tokens < 1.0:
            return False
        self._tokens -= 1.0
        return True
