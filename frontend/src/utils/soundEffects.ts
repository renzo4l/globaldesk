/**
 * Web Audio API synthesizer for enterprise notifications.
 * Generates crisp, subtle, zero-dependency auditory cues for Service Desk operators.
 */

class NotificationSoundService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('global_desk_sound_enabled');
        if (saved !== null) {
          this.soundEnabled = saved === 'true';
        }
      } catch {
        // Storage access fallback
      }
    }
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('global_desk_sound_enabled', String(enabled));
      } catch {
        // Storage access fallback
      }
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxClass) {
        try {
          this.audioCtx = new AudioCtxClass();
        } catch {
          return null;
        }
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Plays a synthesized audio cue based on the ITSM event type.
   */
  public playNotificationSound(type: 'new_ticket' | 'escalation' | 'status_change'): void {
    if (!this.soundEnabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'new_ticket') {
        // High-clarity corporate chime: D5 (587.33Hz) -> A5 (880.00Hz)
        this.playTone(ctx, 587.33, now, 0.16, 'sine', 0.14);
        this.playTone(ctx, 880.0, now + 0.12, 0.28, 'sine', 0.18);
      } else if (type === 'escalation') {
        // Urgent 3-tone ascending alert for escalation: F4 (349Hz) -> A4 (440Hz) -> D5 (587Hz)
        this.playTone(ctx, 349.23, now, 0.12, 'triangle', 0.18);
        this.playTone(ctx, 440.0, now + 0.1, 0.14, 'triangle', 0.2);
        this.playTone(ctx, 587.33, now + 0.22, 0.35, 'sine', 0.24);
      } else {
        // Subtle confirmation transition for status change: G4 (392Hz) -> C5 (523.25Hz)
        this.playTone(ctx, 392.0, now, 0.14, 'sine', 0.12);
        this.playTone(ctx, 523.25, now + 0.1, 0.26, 'sine', 0.15);
      }
    } catch {
      // Graceful fallback if audio is blocked by user browser policy
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    maxGain: number
  ): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack & decay to prevent audio popping
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.04);
    } catch {
      // Audio node fallback
    }
  }
}

export const soundEffects = new NotificationSoundService();
