// Ignore idle/background gaps. A long foreground stall pauses excess time to bound physics work.
export class FrameClock {
  private previous: number | null = null

  reset() {
    this.previous = null
  }

  sample(seconds: number, running: boolean) {
    if (!running) {
      this.reset()
      return 0
    }
    const delta = this.previous === null ? 0 : Math.max(0, seconds - this.previous)
    this.previous = seconds
    return Math.min(delta, .25)
  }
}
