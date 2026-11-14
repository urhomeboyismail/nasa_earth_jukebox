"""Rate limits for the billed routes (Ask, Jukebox): one bucket for the whole server, which caps the bill, and one per visitor,
so a single visitor cannot use up everyone's share. A refusal says how long to wait (Retry-After). Kept out of `app.agent` so
importing it loads no agent code."""
from __future__ import annotations

import math
import time
from collections import OrderedDict
from typing import Callable

from fastapi import HTTPException, Request

#: Visitors remembered at once. The oldest is forgotten first; a forgotten visitor simply starts again with a full bucket.
MAX_VISITORS = 1_000


class TokenBucket:
    """Capacity `per_minute`, refilled continuously at `per_minute / 60` a second. `clock` is injectable for tests."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._capacity = float(per_minute)
        self._tokens = float(per_minute)
        self._clock = clock
        self._last = clock()

    def _refill(self) -> None:
        now = self._clock()
        self._tokens = min(self._capacity, self._tokens + (now - self._last) * self._capacity / 60.0)
        self._last = now

    def take(self) -> bool:
        """Spend one token. False when the bucket is empty."""
        self._refill()
        if self._tokens < 1.0:
            return False
        self._tokens -= 1.0
        return True

    def retry_after(self) -> int:
        """Whole seconds until the next token, at least 1."""
        self._refill()
        return max(1, math.ceil((1.0 - self._tokens) * 60.0 / self._capacity))


class VisitorBuckets:
    """One TokenBucket per visitor key, at most MAX_VISITORS of them."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._per_minute = per_minute
        self._clock = clock
        self._buckets: OrderedDict[str, TokenBucket] = OrderedDict()

    def get(self, key: str) -> TokenBucket:
        bucket = self._buckets.pop(key, None) or TokenBucket(self._per_minute, self._clock)
        self._buckets[key] = bucket
        if len(self._buckets) > MAX_VISITORS:
            self._buckets.popitem(last=False)
        return bucket


def visitor_key(request: Request) -> str:
    """The visitor's address. Behind Render's proxy that is the first X-Forwarded-For entry.
    shortcut: the header can be forged, which only buys a forger more per-visitor share; the whole-server bucket still caps the bill."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def check(request: Request, whole: TokenBucket, visitors: VisitorBuckets) -> None:
    """Raise 429 with Retry-After when the visitor's or the server's bucket is empty. The visitor's is checked first, so a
    visitor who is over their share does not spend the server's."""
    for bucket in (visitors.get(visitor_key(request)), whole):
        if not bucket.take():
            raise HTTPException(status_code=429, detail="rate_limited", headers={"Retry-After": str(bucket.retry_after())})
