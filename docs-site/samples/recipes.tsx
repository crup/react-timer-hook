import React, { useEffect, useMemo, useState } from 'react';
import { durationParts, useTimer, useTimerGroup } from '../../src';
import type { TimerSnapshot } from '../../src';

const now = () => Date.now();

export function WallClockSample() {
  const timer = useTimer({ autoStart: true, updateIntervalMs: 1000 });
  return <SampleBox value={new Date(timer.now).toLocaleTimeString()} note="Wall-clock display from timer.now." />;
}

export function StopwatchSample() {
  const timer = useTimer({ updateIntervalMs: 100 });
  return (
    <SampleBox value={`${(timer.elapsedMilliseconds / 1000).toFixed(1)}s`} note={`Status: ${timer.status}`}>
      <Controls timer={timer} />
    </SampleBox>
  );
}

export function AbsoluteCountdownSample() {
  const [expiresAt, setExpiresAt] = useState(() => now() + 30_000);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
  });
  const remainingSeconds = Math.ceil(Math.max(0, expiresAt - timer.now) / 1000);

  return (
    <SampleBox value={`${remainingSeconds}s`} note="Absolute deadline countdown.">
      <button className="sample-button" onClick={() => {
        setExpiresAt(now() + 30_000);
        timer.restart();
      }}>
        Reset deadline
      </button>
    </SampleBox>
  );
}

export function PausableCountdownSample() {
  const durationMs = 20_000;
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= durationMs,
  });
  const parts = durationParts(durationMs - timer.elapsedMilliseconds);

  return (
    <SampleBox value={`${parts.seconds}s`} note="Pausable duration countdown.">
      <Controls timer={timer} />
    </SampleBox>
  );
}

export function ManualTimerSample() {
  const timer = useTimer({ updateIntervalMs: 1000 });
  return (
    <SampleBox value={`${Math.floor(timer.elapsedMilliseconds / 1000)}s`} note="Manual start, restart, reset.">
      <Controls timer={timer} />
    </SampleBox>
  );
}

export function OnEndSample() {
  const [events, setEvents] = useState<string[]>([]);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= 5000,
    onEnd: () => setEvents(previous => [`ended at ${new Date().toLocaleTimeString()}`, ...previous].slice(0, 3)),
  });

  return (
    <SampleBox value={timer.isEnded ? 'Ended' : `${Math.ceil((5000 - timer.elapsedMilliseconds) / 1000)}s`} note={events[0] ?? 'Waiting for onEnd.'}>
      <button className="sample-button" onClick={timer.restart}>Run again</button>
    </SampleBox>
  );
}

export function PollingSample() {
  const [polls, setPolls] = useState(0);
  useTimer({
    autoStart: true,
    updateIntervalMs: 500,
    schedules: [
      {
        id: 'demo-poll',
        everyMs: 1500,
        callback: () => setPolls(value => value + 1),
      },
    ],
  });

  return <SampleBox value={`${polls} polls`} note="A schedule increments this counter every 1.5 seconds." />;
}

export function PollAndCancelSample() {
  const [checks, setChecks] = useState(0);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 500,
    schedules: [
      {
        id: 'cancel-after-three',
        everyMs: 1000,
        callback: (_snapshot, controls) => {
          setChecks(value => {
            const next = value + 1;
            if (next >= 3) controls.cancel('demo-complete');
            return next;
          });
        },
      },
    ],
  });

  return (
    <SampleBox value={timer.isCancelled ? 'Cancelled' : `${checks} checks`} note={timer.cancelReason ?? 'Cancels after 3 checks.'}>
      <button className="sample-button" onClick={() => {
        setChecks(0);
        timer.restart();
      }}>
        Restart
      </button>
    </SampleBox>
  );
}

export function BackendEventSample() {
  const timer = useTimer({ autoStart: true, updateIntervalMs: 500 });

  useEffect(() => {
    const timeout = setTimeout(() => timer.cancel('backend-event'), 3500);
    return () => clearTimeout(timeout);
  }, [timer.cancel]);

  return (
    <SampleBox value={timer.isCancelled ? 'Stopped' : 'Listening'} note={timer.cancelReason ?? 'Simulated backend event fires after 3.5 seconds.'}>
      <button className="sample-button" onClick={timer.restart}>Restart subscription demo</button>
    </SampleBox>
  );
}

export function DebugLogsSample() {
  const [logs, setLogs] = useState<string[]>([]);
  const timer = useTimer({
    updateIntervalMs: 1000,
    debug: {
      label: 'docs-demo',
      includeTicks: false,
      logger: event => setLogs(previous => [event.type, ...previous].slice(0, 4)),
    },
  });

  return (
    <SampleBox value={logs[0] ?? 'No logs yet'} note={logs.join(' | ') || 'Start the timer to emit semantic debug logs.'}>
      <Controls timer={timer} />
    </SampleBox>
  );
}

export function ManyDisplayCountdownsSample() {
  const clock = useTimer({ autoStart: true, updateIntervalMs: 1000 });
  const deadlines = useMemo(() => [15_000, 30_000, 45_000].map(offset => now() + offset), []);

  return (
    <div className="sample-box">
      {deadlines.map((deadline, index) => (
        <div key={deadline} className="sample-row">
          <strong>Item {index + 1}</strong>
          <span>{Math.ceil(Math.max(0, deadline - clock.now) / 1000)}s left</span>
        </div>
      ))}
      <p className="sample-muted">One shared timer drives all display-only rows.</p>
    </div>
  );
}

export function TimerGroupSample() {
  const items = useMemo(
    () => [
      { id: 'upload-a', autoStart: true, endWhen: (snapshot: TimerSnapshot) => snapshot.elapsedMilliseconds >= 20_000 },
      { id: 'upload-b', autoStart: true, endWhen: (snapshot: TimerSnapshot) => snapshot.elapsedMilliseconds >= 30_000 },
      { id: 'upload-c', autoStart: true, endWhen: (snapshot: TimerSnapshot) => snapshot.elapsedMilliseconds >= 40_000 },
    ],
    [],
  );
  const timers = useTimerGroup({ updateIntervalMs: 1000, items });

  return (
    <div className="sample-box">
      {timers.ids.map(id => {
        const timer = timers.get(id);
        return (
          <div key={id} className="sample-row">
            <strong>{id}</strong>
            <span>{timer?.status}</span>
            <button className="sample-button secondary" onClick={() => timers.pause(id)}>Pause</button>
            <button className="sample-button" onClick={() => timers.resume(id)}>Resume</button>
          </div>
        );
      })}
    </div>
  );
}

export function GroupControlsSample() {
  const timers = useTimerGroup({
    updateIntervalMs: 1000,
    items: ['a', 'b', 'c'].map(id => ({ id, autoStart: true })),
  });

  return (
    <SampleBox value={`${timers.size} timers`} note={`Running: ${timers.ids.filter(id => timers.get(id)?.isRunning).length}`}>
      <button className="sample-button secondary" onClick={timers.pauseAll}>Pause all</button>
      <button className="sample-button" onClick={timers.resumeAll}>Resume all</button>
      <button className="sample-button" onClick={timers.restartAll}>Restart all</button>
    </SampleBox>
  );
}

export function PerItemPollingSample() {
  const [checks, setChecks] = useState<Record<string, number>>({});
  const timers = useTimerGroup({
    updateIntervalMs: 500,
    items: ['job-a', 'job-b'].map(id => ({
      id,
      autoStart: true,
      schedules: [
        {
          id: 'job-status',
          everyMs: id === 'job-a' ? 1000 : 1500,
          callback: () => setChecks(value => ({ ...value, [id]: (value[id] ?? 0) + 1 })),
        },
      ],
    })),
  });

  return (
    <div className="sample-box">
      {timers.ids.map(id => <div key={id}>{id}: {checks[id] ?? 0} checks</div>)}
    </div>
  );
}

export function DynamicItemsSample() {
  const [counter, setCounter] = useState(1);
  const timers = useTimerGroup({ updateIntervalMs: 1000 });

  function addTimer() {
    const id = `timer-${counter}`;
    setCounter(value => value + 1);
    timers.add({ id, autoStart: true });
  }

  return (
    <SampleBox value={`${timers.size} active`} note="Add/remove timer items at runtime.">
      <button className="sample-button" onClick={addTimer}>Add timer</button>
      {timers.ids.map(id => (
        <button key={id} className="sample-button secondary" onClick={() => timers.remove(id)}>
          Remove {id}
        </button>
      ))}
    </SampleBox>
  );
}

type TimerControlsLike = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  reset(): void;
};

function Controls({ timer }: { timer: TimerControlsLike }) {
  return (
    <div className="sample-row">
      <button className="sample-button" onClick={timer.start}>Start</button>
      <button className="sample-button secondary" onClick={timer.pause}>Pause</button>
      <button className="sample-button" onClick={timer.resume}>Resume</button>
      <button className="sample-button" onClick={timer.restart}>Restart</button>
      <button className="sample-button secondary" onClick={timer.reset}>Reset</button>
    </div>
  );
}

function SampleBox({ value, note, children }: { value: string; note: string; children?: React.ReactNode }) {
  return (
    <div className="sample-box">
      <div className="sample-value">{value}</div>
      <div className="sample-muted">{note}</div>
      {children ? <div className="sample-row">{children}</div> : null}
    </div>
  );
}
