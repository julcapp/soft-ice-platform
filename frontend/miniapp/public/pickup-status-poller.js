/* Repeat status reads after each response; never overlap requests. */
(function (scope) {
  'use strict';
  scope.SoftIceStartPickupPolling = function (poll, interval = 1400) {
    let active = true, timer;
    const tick = async () => {
      if (!active) return;
      try { await poll(); }
      finally { if (active) timer = scope.setTimeout(tick, interval); }
    };
    timer = scope.setTimeout(tick, interval);
    return () => { active = false; scope.clearTimeout(timer); };
  };
})(window);
