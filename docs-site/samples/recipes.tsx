import React, { useEffect, useMemo, useRef, useState } from 'react';
import { durationParts, useTimer, useTimerGroup } from '../../src';
import type { TimerControls, TimerSnapshot } from '../../src';

const now = () => Date.now();

type TimerLike = TimerSnapshot & TimerControls;

type ControlSet = {
  start?: boolean;
  pause?: boolean;
  resume?: boolean;
  restart?: boolean;
  reset?: boolean;
  cancel?: boolean;
};

export function WallClockSample() {
  const timer = useTimer({ autoStart: true, updateIntervalMs: 1000 });
  const date = new Date(timer.now);

  return (
    <DemoShell eyebrow="Wall clock" title={date.toLocaleTimeString()} status={timer.status}>
      <MetricGrid
        metrics={[
          { label: 'Local date', value: date.toLocaleDateString() },
          { label: 'Timestamp', value: String(timer.now) },
          { label: 'Render ticks', value: String(timer.tick) },
        ]}
      />
      <p className="sample-muted">Format in your app with `Intl`, `date-fns`, or your design system.</p>
    </DemoShell>
  );
}

export function StopwatchSample() {
  const timer = useTimer({ updateIntervalMs: 100 });
  const elapsed = timer.elapsedMilliseconds;

  return (
    <DemoShell eyebrow="Stopwatch" title={formatElapsed(elapsed)} status={timer.status}>
      <Progress value={Math.min(100, (elapsed / 30_000) * 100)} />
      <MetricGrid
        metrics={[
          { label: 'Elapsed', value: `${Math.floor(elapsed)}ms` },
          { label: 'Tick', value: String(timer.tick) },
          { label: 'Generation', value: timer.startedAt ? new Date(timer.startedAt).toLocaleTimeString() : 'not started' },
        ]}
      />
      <TimerControlsPanel timer={timer} />
    </DemoShell>
  );
}

export function AbsoluteCountdownSample() {
  const [expiresAt, setExpiresAt] = useState(() => now() + 30_000);
  const expiresAtRef = useRef(expiresAt);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 250,
    endWhen: snapshot => snapshot.now >= expiresAtRef.current,
  });
  const remainingMs = Math.max(0, expiresAt - timer.now);

  function resetDeadline() {
    const nextDeadline = now() + 30_000;
    expiresAtRef.current = nextDeadline;
    setExpiresAt(nextDeadline);
    timer.restart();
  }

  return (
    <DemoShell eyebrow="Absolute deadline" title={formatClock(remainingMs)} status={timer.status}>
      <Progress value={100 - (remainingMs / 30_000) * 100} tone={timer.isEnded ? 'complete' : 'active'} />
      <MetricGrid
        metrics={[
          { label: 'Deadline', value: new Date(expiresAt).toLocaleTimeString() },
          { label: 'Remaining', value: `${Math.ceil(remainingMs / 1000)}s` },
          { label: 'Wall-clock source', value: 'timer.now' },
        ]}
      />
      <div className="sample-toolbar">
        <ActionButton onClick={timer.pause} disabled={!timer.isRunning} label="Pause" tone="secondary" />
        <ActionButton onClick={timer.resume} disabled={!timer.isPaused} label="Resume" />
        <ActionButton onClick={resetDeadline} label={timer.isEnded ? 'Run again' : 'Reset deadline'} />
      </div>
    </DemoShell>
  );
}

export function PausableCountdownSample() {
  const durationMs = 20_000;
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 250,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= durationMs,
  });
  const remainingMs = Math.max(0, durationMs - timer.elapsedMilliseconds);

  return (
    <DemoShell eyebrow="Pausable countdown" title={formatClock(remainingMs)} status={timer.status}>
      <Progress value={100 - (remainingMs / durationMs) * 100} tone={timer.isEnded ? 'complete' : 'active'} />
      <MetricGrid
        metrics={[
          { label: 'Duration', value: '20s' },
          { label: 'Elapsed active time', value: formatElapsed(timer.elapsedMilliseconds) },
          { label: 'Pause behavior', value: 'freezes elapsed time' },
        ]}
      />
      <TimerControlsPanel timer={timer} hideStart />
    </DemoShell>
  );
}

export function ManualTimerSample() {
  const timer = useTimer({ updateIntervalMs: 500 });

  return (
    <DemoShell eyebrow="Manual lifecycle" title={formatElapsed(timer.elapsedMilliseconds)} status={timer.status}>
      <Timeline timer={timer} />
      <TimerControlsPanel timer={timer} allowCancel />
    </DemoShell>
  );
}

export function OnEndSample() {
  const [events, setEvents] = useState<string[]>([]);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 250,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= 5000,
    onEnd: () => setEvents(previous => [`onEnd fired at ${new Date().toLocaleTimeString()}`, ...previous].slice(0, 4)),
  });
  const remainingMs = Math.max(0, 5000 - timer.elapsedMilliseconds);

  return (
    <DemoShell eyebrow="Once-only callback" title={timer.isEnded ? 'Completed' : formatClock(remainingMs)} status={timer.status}>
      <Progress value={100 - (remainingMs / 5000) * 100} tone={timer.isEnded ? 'complete' : 'active'} />
      <EventStream events={events.length ? events : ['waiting for first end event']} />
      <div className="sample-toolbar">
        <ActionButton onClick={timer.pause} disabled={!timer.isRunning} label="Pause" tone="secondary" />
        <ActionButton onClick={timer.resume} disabled={!timer.isPaused} label="Resume" />
        <ActionButton onClick={timer.restart} label="Run generation again" />
      </div>
    </DemoShell>
  );
}

export function PollingSample() {
  const [polls, setPolls] = useState<string[]>([]);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 250,
    schedules: [
      {
        id: 'demo-poll',
        everyMs: 1500,
        leading: true,
        callback: () => setPolls(value => [`poll ${value.length + 1} at ${new Date().toLocaleTimeString()}`, ...value].slice(0, 5)),
      },
    ],
  });

  return (
    <DemoShell eyebrow="Schedule" title={`${polls.length} polls`} status={timer.status}>
      <MetricGrid
        metrics={[
          { label: 'Cadence', value: '1.5s' },
          { label: 'Overlap', value: 'skip by default' },
          { label: 'Scheduler', value: 'active while running' },
        ]}
      />
      <EventStream events={polls.length ? polls : ['leading poll starts immediately']} />
      <TimerControlsPanel timer={timer} controls={{ cancel: true }} />
    </DemoShell>
  );
}

export function PollAndCancelSample() {
  const [checks, setChecks] = useState<string[]>([]);
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 250,
    schedules: [
      {
        id: 'auction-status',
        everyMs: 1000,
        callback: (_snapshot, controls) => {
          setChecks(value => {
            const next = [`backend check ${value.length + 1}`, ...value].slice(0, 5);
            if (next.length >= 3) controls.cancel('sold');
            return next;
          });
        },
      },
    ],
  });

  function restart() {
    setChecks([]);
    timer.restart();
  }

  return (
    <DemoShell eyebrow="Poll and cancel" title={timer.isCancelled ? 'Sold' : `${checks.length}/3 checks`} status={timer.status} reason={timer.cancelReason}>
      <Progress value={(checks.length / 3) * 100} tone={timer.isCancelled ? 'warning' : 'active'} />
      <EventStream events={checks.length ? checks : ['waiting for backend status']} />
      <div className="sample-toolbar">
        <ActionButton onClick={timer.pause} disabled={!timer.isRunning} label="Pause polling" tone="secondary" />
        <ActionButton onClick={timer.resume} disabled={!timer.isPaused} label="Resume" />
        <ActionButton onClick={restart} label="Restart demo" />
      </div>
    </DemoShell>
  );
}

export function BackendEventSample() {
  const [run, setRun] = useState(0);
  const timer = useTimer({ autoStart: true, updateIntervalMs: 250 });

  useEffect(() => {
    if (!timer.isRunning) return undefined;
    const timeout = setTimeout(() => timer.cancel('backend-event: auction sold'), 3500);
    return () => clearTimeout(timeout);
  }, [run, timer.cancel, timer.isRunning]);

  function restart() {
    setRun(value => value + 1);
    timer.restart();
  }

  return (
    <DemoShell eyebrow="External event" title={timer.isCancelled ? 'Stopped by server' : 'Listening'} status={timer.status} reason={timer.cancelReason}>
      <Progress value={Math.min(100, (timer.elapsedMilliseconds / 3500) * 100)} tone={timer.isCancelled ? 'warning' : 'active'} />
      <MetricGrid
        metrics={[
          { label: 'Transport', value: 'WebSocket/SSE' },
          { label: 'Local state', value: timer.status },
          { label: 'Action', value: 'cancel(reason)' },
        ]}
      />
      <div className="sample-toolbar">
        <ActionButton onClick={() => timer.cancel('backend-event: manual')} disabled={!timer.isRunning} label="Simulate event now" tone="secondary" />
        <ActionButton onClick={restart} label="Restart listener" />
      </div>
    </DemoShell>
  );
}

export function DebugLogsSample() {
  const [logs, setLogs] = useState<string[]>([]);
  const timer = useTimer({
    updateIntervalMs: 1000,
    debug: {
      label: 'docs-demo',
      includeTicks: false,
      logger: event => setLogs(previous => [`${event.type} (${event.status})`, ...previous].slice(0, 5)),
    },
  });

  return (
    <DemoShell eyebrow="Debug events" title={logs[0] ?? 'No events yet'} status={timer.status}>
      <EventStream events={logs.length ? logs : ['start, pause, resume, cancel, or restart to emit events']} />
      <TimerControlsPanel timer={timer} allowCancel />
    </DemoShell>
  );
}

export function ManyDisplayCountdownsSample() {
  const clock = useTimer({ autoStart: true, updateIntervalMs: 1000 });
  const deadlines = useMemo(() => [12_000, 24_000, 36_000, 48_000].map(offset => now() + offset), []);

  return (
    <div className="sample-box">
      <div className="sample-board">
        {deadlines.map((deadline, index) => {
          const remainingMs = Math.max(0, deadline - clock.now);
          const total = [12_000, 24_000, 36_000, 48_000][index];
          return (
            <div key={deadline} className="sample-row-card">
              <div>
                <strong>Lot {index + 1}</strong>
                <span>{formatClock(remainingMs)} left</span>
              </div>
              <Progress value={100 - (remainingMs / total) * 100} compact />
            </div>
          );
        })}
      </div>
      <p className="sample-muted">One shared `useTimer()` drives every display-only row.</p>
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
  const timers = useTimerGroup({ updateIntervalMs: 500, items });

  return (
    <div className="sample-box">
      <div className="sample-board">
        {timers.ids.map((id, index) => {
          const timer = timers.get(id);
          const total = [20_000, 30_000, 40_000][index];
          return (
            <div key={id} className="sample-row-card">
              <div>
                <strong>{id}</strong>
                <span>{timer ? formatElapsed(timer.elapsedMilliseconds) : 'removed'} · {timer?.status}</span>
              </div>
              <Progress value={timer ? Math.min(100, (timer.elapsedMilliseconds / total) * 100) : 0} compact tone={timer?.isEnded ? 'complete' : 'active'} />
              <div className="sample-mini-controls">
                <ActionButton onClick={() => timers.pause(id)} disabled={!timer?.isRunning} label="Pause" tone="secondary" small />
                <ActionButton onClick={() => timers.resume(id)} disabled={!timer?.isPaused} label="Resume" small />
                <ActionButton onClick={() => timers.restart(id)} label="Restart" small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GroupControlsSample() {
  const timers = useTimerGroup({
    updateIntervalMs: 500,
    items: ['checkout', 'seat-hold', 'job-timeout'].map(id => ({ id, autoStart: true })),
  });
  const runningCount = timers.ids.filter(id => timers.get(id)?.isRunning).length;

  return (
    <DemoShell eyebrow="Group control plane" title={`${runningCount}/${timers.size} running`} status={runningCount ? 'running' : 'paused'}>
      <div className="sample-board">
        {timers.ids.map(id => {
          const timer = timers.get(id);
          return (
            <div key={id} className="sample-row-card">
              <div>
                <strong>{id}</strong>
                <span>{timer?.status} · {timer ? formatElapsed(timer.elapsedMilliseconds) : '-'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sample-toolbar">
        <ActionButton onClick={timers.pauseAll} disabled={runningCount === 0} label="Pause all" tone="secondary" />
        <ActionButton onClick={timers.resumeAll} disabled={runningCount === timers.size} label="Resume all" />
        <ActionButton onClick={timers.restartAll} label="Restart all" />
      </div>
    </DemoShell>
  );
}

export function PerItemPollingSample() {
  const [checks, setChecks] = useState<Record<string, number>>({});
  const timers = useTimerGroup({
    updateIntervalMs: 500,
    items: ['job-a', 'job-b', 'job-c'].map((id, index) => ({
      id,
      autoStart: true,
      schedules: [
        {
          id: 'job-status',
          everyMs: 1000 + index * 500,
          leading: true,
          callback: () => setChecks(value => ({ ...value, [id]: (value[id] ?? 0) + 1 })),
        },
      ],
    })),
  });

  return (
    <div className="sample-box">
      <div className="sample-board">
        {timers.ids.map(id => {
          const timer = timers.get(id);
          return (
            <div key={id} className="sample-row-card">
              <div>
                <strong>{id}</strong>
                <span>{checks[id] ?? 0} status checks · {timer?.status}</span>
              </div>
              <div className="sample-mini-controls">
                <ActionButton onClick={() => timers.pause(id)} disabled={!timer?.isRunning} label="Pause" small tone="secondary" />
                <ActionButton onClick={() => timers.resume(id)} disabled={!timer?.isPaused} label="Resume" small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DynamicItemsSample() {
  const [counter, setCounter] = useState(1);
  const timers = useTimerGroup({ updateIntervalMs: 500 });

  function addTimer() {
    const id = `timer-${counter}`;
    setCounter(value => value + 1);
    timers.add({ id, autoStart: true });
  }

  return (
    <DemoShell eyebrow="Dynamic timers" title={`${timers.size} active`} status={timers.size ? 'running' : 'idle'}>
      <div className="sample-board">
        {timers.ids.length === 0 ? <p className="sample-muted">Add runtime items without calling hooks in a loop.</p> : null}
        {timers.ids.map(id => {
          const timer = timers.get(id);
          return (
            <div key={id} className="sample-row-card">
              <div>
                <strong>{id}</strong>
                <span>{timer ? formatElapsed(timer.elapsedMilliseconds) : '-'} · {timer?.status}</span>
              </div>
              <ActionButton onClick={() => timers.remove(id)} label="Remove" small tone="secondary" />
            </div>
          );
        })}
      </div>
      <div className="sample-toolbar">
        <ActionButton onClick={addTimer} label="Add timer" />
        <ActionButton onClick={timers.clear} disabled={timers.size === 0} label="Clear all" tone="secondary" />
      </div>
    </DemoShell>
  );
}

function TimerControlsPanel({
  timer,
  allowCancel = false,
  hideStart = false,
  controls,
}: {
  timer: TimerLike;
  allowCancel?: boolean;
  hideStart?: boolean;
  controls?: ControlSet;
}) {
  const show = {
    start: !hideStart && (controls?.start ?? true),
    pause: controls?.pause ?? true,
    resume: controls?.resume ?? true,
    restart: controls?.restart ?? true,
    reset: controls?.reset ?? true,
    cancel: controls?.cancel ?? allowCancel,
  };

  return (
    <div className="sample-toolbar">
      {show.start ? <ActionButton onClick={timer.start} disabled={!timer.isIdle} label="Start" /> : null}
      {show.pause ? <ActionButton onClick={timer.pause} disabled={!timer.isRunning} label="Pause" tone="secondary" /> : null}
      {show.resume ? <ActionButton onClick={timer.resume} disabled={!timer.isPaused} label="Resume" /> : null}
      {show.restart ? <ActionButton onClick={timer.restart} label="Restart" /> : null}
      {show.reset ? <ActionButton onClick={timer.reset} disabled={timer.isIdle} label="Reset" tone="secondary" /> : null}
      {show.cancel ? <ActionButton onClick={() => timer.cancel('manual-cancel')} disabled={!timer.isRunning && !timer.isPaused} label="Cancel" tone="danger" /> : null}
    </div>
  );
}

function DemoShell({
  eyebrow,
  title,
  status,
  reason,
  children,
}: {
  eyebrow: string;
  title: string;
  status: TimerSnapshot['status'] | 'running' | 'paused' | 'idle';
  reason?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="sample-shell">
      <div className="sample-hero-line">
        <div>
          <p className="sample-eyebrow">{eyebrow}</p>
          <div className="sample-value">{title}</div>
        </div>
        <StatusBadge status={status} reason={reason} />
      </div>
      <div className="sample-content">{children}</div>
    </div>
  );
}

function StatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  return (
    <span className={`sample-status sample-status--${status}`}>
      {reason ? `${status}: ${reason}` : status}
    </span>
  );
}

function ActionButton({
  onClick,
  disabled,
  label,
  tone = 'primary',
  small = false,
}: {
  onClick(): void;
  disabled?: boolean;
  label: string;
  tone?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
}) {
  return (
    <button className={`sample-button sample-button--${tone}${small ? ' sample-button--small' : ''}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  return (
    <div className="sample-metrics">
      {metrics.map(metric => (
        <div key={metric.label} className="sample-metric">
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EventStream({ events }: { events: string[] }) {
  return (
    <ol className="sample-events">
      {events.map((event, index) => (
        <li key={`${event}-${index}`}>{event}</li>
      ))}
    </ol>
  );
}

function Progress({ value, compact = false, tone = 'active' }: { value: number; compact?: boolean; tone?: 'active' | 'complete' | 'warning' }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <div className={`sample-progress${compact ? ' sample-progress--compact' : ''}`} aria-hidden="true">
      <span className={`sample-progress__bar sample-progress__bar--${tone}`} style={{ width }} />
    </div>
  );
}

function Timeline({ timer }: { timer: TimerSnapshot }) {
  const items = [
    { label: 'started', value: timer.startedAt },
    { label: 'paused', value: timer.pausedAt },
    { label: 'ended', value: timer.endedAt },
    { label: 'cancelled', value: timer.cancelledAt },
  ];

  return (
    <div className="sample-timeline">
      {items.map(item => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value ? new Date(item.value).toLocaleTimeString() : '-'}</strong>
        </div>
      ))}
    </div>
  );
}

function formatClock(ms: number) {
  const parts = durationParts(Math.max(0, ms));
  return `${String(parts.minutes).padStart(2, '0')}:${String(parts.seconds).padStart(2, '0')}`;
}

function formatElapsed(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}
