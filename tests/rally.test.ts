import { moonGateCollision } from '../src/assets/moonGateCollision.ts'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stoneBellCollision } from '../src/assets/stoneBellCollision.ts'
import { lotusPetalCollision } from '../src/assets/lotusPetalCollision.ts'
import { mountainSealCollision } from '../src/assets/mountainSealCollision.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Vector3 } from 'three'
import { CLOUD_TERRACE, SUMMIT } from '../src/paintingLayout.ts'
import { GATE, LOTUS, STONE_BELL } from '../src/gardenLayout.ts'
import { BALL_RADIUS, COURT, Rally, STEP, initPhysics, isOut, type Cue } from '../src/rally.ts'
import { createRallyFigurePose, RACKET_REACH } from '../src/rallyFigurePose.ts'

await initPhysics()

function until(rally: Rally, matches: () => boolean) {
  for (let remaining = 600; remaining > 0 && !matches(); remaining -= 1) rally.step()
  assert.ok(matches(), `Timed out at ${rally.getStatus().phase}`)
}

function advance(rally: Rally, seconds: number) {
  for (let remaining = Math.round(seconds / STEP); remaining > 0; remaining -= 1) rally.step()
}

test('both animated racket faces use the real contact point and leave it in follow-through', () => {
  const rally = new Rally(() => {}, 'garden')
  try {
    const script = [false,true] as const
    rally.swing()
    for (const away of script) {
      if (away) until(rally, () => rally.getStatus().phase === 'incoming')
      const contact = away ? rally.shadowContact! : rally.playerContact!
      assert.equal(contact.time, rally.time)
      const target = new Vector3(contact.position.x,contact.position.y,contact.position.z)
      const flip = away ? -1 : 1
      const origin = new Vector3(target.x - flip*.70, 0, target.z + flip*.55)
      const pose = createRallyFigurePose()
      const face = () => {
        const point = new Vector3(0,RACKET_REACH,0).applyQuaternion(pose.racket).add(pose.joint.rightWrist)
        return point.multiply(new Vector3(flip,1,flip)).add(origin)
      }
      pose.sample(rally,origin,away,STEP)
      assert.ok(face().distanceTo(target) < .001)
      advance(rally,.24)
      pose.sample(rally,origin,away,STEP)
      assert.ok(face().distanceTo(target) > .18)
    }
    rally.reset()
    assert.equal(rally.playerContact,null)
    assert.equal(rally.shadowContact,null)
  } finally { rally.dispose() }
})

test('a serve, three manual inputs, variable returns, and a missed fourth ball', () => {
  const cues: Cue[] = []
  const rally = new Rally((cue) => cues.push(cue))
  try {
    advance(rally, 0.8)
    assert.equal(rally.getStatus().phase, 'ready')
    rally.swing()
    const landings: number[] = []
    for (const [index, aim] of [-3, 3, 0].entries()) {
      until(rally, () => rally.getStatus().phase === 'incoming')
      const landing = rally.landing()!
      landings.push(landing.x)
      assert.ok(landing.z > 0 && landing.z < COURT.halfLength)
      until(rally, () => rally.getStatus().phase === 'window')
      assert.ok(rally.position().y > BALL_RADIUS)
      assert.ok(rally.velocity().y > 0)
      advance(rally, 0.23)
      rally.setAim(aim)
      rally.swing()
      assert.equal(rally.getStatus().quality, 'clean')
      assert.equal(rally.getStatus().returns, index)
      assert.ok(Math.abs(rally.landing()!.x - aim) < 0.06)
      until(rally, () => rally.getStatus().returns === index + 1)
    }
    assert.equal(new Set(landings.map((x) => Math.round(x * 10))).size, 3)
    assert.equal(cues.filter((cue) => cue === 'hit').length, 3)
    assert.equal(cues.filter((cue) => cue === 'target').length, 1)
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'miss')
    assert.equal(rally.getStatus().returns, 3)
  } finally {
    rally.dispose()
  }
})

test('an early swing expires, and an input just before the window is accepted', () => {
  const rally = new Rally()
  try {
    rally.swing()
    const serveContact = rally.playerContact
    assert.ok(serveContact)
    until(rally, () => rally.getStatus().phase === 'incoming')
    rally.swing()
    assert.equal(rally.getStatus().early, true)
    assert.equal(rally.playerContact, serveContact)
    advance(rally, 0.3)
    assert.equal(rally.getStatus().early, false)
    assert.equal(rally.getStatus().phase, 'incoming')
    until(rally, () => rally.landing() !== null && rally.position().z >= rally.landing()!.z - 0.26)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'outbound')
    assert.notEqual(rally.getStatus().quality, 'clean')
    assert.ok(rally.playerContact!.time > serveContact.time)
    assert.equal(rally.playerContact!.time, rally.lastSwing)
    assert.deepEqual(rally.playerContact!.position, rally.position())
  } finally {
    rally.dispose()
  }
})

test('an aimed return can land out and a reset restores the entire starting rally', () => {
  const rally = new Rally()
  try {
    const initialPosition = rally.position()
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'window')
    rally.setAim(100)
    assert.equal(rally.aim, COURT.aimLimit)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'out')
    assert.equal(rally.getStatus().returns, 0)
    assert.ok(rally.position().y > 0)
    rally.reset()
    assert.deepEqual(rally.getStatus(), { phase: 'ready', returns: 0, fault: null, quality: null, early: false })
    assert.deepEqual(rally.position(), initialPosition)
    assert.equal(rally.aim, 0)
    assert.equal(rally.playerContact, null)
    assert.equal(rally.lastImpact, -Infinity)
    assert.equal(rally.lastShadowSwing, -Infinity)
    assert.equal(rally.landing(), null)
    assert.deepEqual(Object.values(rally.velocity()), [0, 0, 0])
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'window')
  } finally {
    rally.dispose()
  }
})

test('a ball on the boundary is valid, and a bounce on the wrong side is out', () => {
  assert.equal(isOut(COURT.halfWidth + BALL_RADIUS, -COURT.halfLength, -1), false)
  assert.equal(isOut(COURT.halfWidth + BALL_RADIUS + 0.01, -COURT.halfLength, -1), true)
  assert.equal(isOut(0, 2, -1), true)
})

test('CCD stops a fast, low ball at the net and reports the fault', () => {
  const rally = new Rally()
  try {
    rally.swing()
    // Inject a net-height shot just before the net to exercise the high-speed collision.
    const body = rally['ball']
    body.setTranslation({ x: 0, y: 0.65, z: 0.40 }, true)
    body.setLinvel({ x: 0, y: 0, z: -125 }, true)
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'net')
    assert.ok(rally.position().z >= COURT.netDepth / 2)
    assert.equal(rally.getStatus().returns, 0)
  } finally {
    rally.dispose()
  }
})

function openLotus(rally:Rally) {
  rally.setAim(LOTUS.x, LOTUS.z)
  rally.swing()
  until(rally, () => rally.getStatus().ritual === 'bell')
}
function ringBell(rally:Rally) {
  openLotus(rally)
  rally.setAim(STONE_BELL.x, STONE_BELL.z)
  rally.swing()
  until(rally, () => rally.getStatus().ritual === 'passage')
}

test('the runtime Aholo petal mesh supplies the collision that reveals the bell', () => {
  const bytes = readFileSync(lotusPetalCollision.source)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), lotusPetalCollision.sourceSha256)
  const rally = new Rally(() => {}, 'garden')
  try {
    // This aimed flight reaches a petal outside ball reach of the central heart.
    rally.setAim(LOTUS.x + .5, LOTUS.z)
    rally.swing()
    until(rally, () => rally.getStatus().ritual === 'bell')
    assert.equal(rally.lotusContact, 'petal')
    assert.ok(Math.hypot(rally.impact.x - LOTUS.x, rally.impact.z - LOTUS.z) > .24 + BALL_RADIUS)
    assert.ok(rally['lotusPetals'].every(petal => !petal.isEnabled()))
    assert.equal(rally['bell']?.isEnabled(), true)
    rally.reset()
    assert.ok(rally['lotusPetals'].every(petal => petal.isEnabled()))
    assert.equal(rally.lotusContact, null)

    // Negative control. Remove only the petal colliders and replay the same shot
    // with the heart, pond, and trajectory unchanged.
    rally['lotusPetals'].forEach(petal => petal.setEnabled(false))
    rally.setAim(LOTUS.x + .5, LOTUS.z)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'water')
    assert.equal(rally.getStatus().ritual, 'lotus')
    assert.equal(rally.lotusContact, null)
    assert.equal(rally['bell']?.isEnabled(), false)
  } finally {
    rally.dispose()
  }
})

test('a lotus strike reveals the bell, which opens the real ball gate', () => {
  const cues: Cue[] = []
  const rally = new Rally(cue => cues.push(cue), 'garden')
  try {
    assert.equal(rally['bell']?.isEnabled(), false)
    assert.equal(rally['gate']?.isEnabled(), true)
    rally.setAim(LOTUS.x,LOTUS.z+1.15)
    rally.swing()
    until(rally,()=>rally.getStatus().phase==='ended')
    assert.equal(rally.getStatus().fault,'water')
    assert.equal(rally.getStatus().ritual,'lotus')
    assert.equal(rally['bell']?.isEnabled(),false)
    assert.ok(rally.position().y<0)
    rally.retry()
    openLotus(rally)
    const lotusContact = rally.impact
    assert.ok(Math.hypot(lotusContact.x - LOTUS.x, lotusContact.z - LOTUS.z) <= LOTUS.radius + BALL_RADIUS)
    assert.ok(lotusContact.y > BALL_RADIUS)
    assert.equal(rally['bell']?.isEnabled(), true)
    assert.equal(rally['passage']?.isEnabled(), false)
    rally.setAim(STONE_BELL.x, STONE_BELL.z)
    rally.swing()
    until(rally, () => rally.getStatus().ritual === 'passage')
    assert.equal(rally['gate']?.isEnabled(), false)
    assert.equal(rally['passage']?.isEnabled(), true)
    assert.equal(rally['bell']?.isEnabled(), false)
    assert.equal(rally.getStatus().phase, 'ready')
    const contact = rally.impact
    assert.ok(Math.hypot(contact.x - STONE_BELL.x, contact.z - STONE_BELL.z) <= STONE_BELL.radius + BALL_RADIUS + .02)
    advance(rally, 3)
    rally.setAim(GATE.x + 4)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'gate')
    rally.retry()
    assert.equal(rally.getStatus().ritual, 'passage')
    assert.equal(rally['gate']?.isEnabled(), false)
    assert.equal(rally.aim, GATE.x)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().ritual, 'cleared')
    assert.equal(rally.getStatus().fault, null)
    assert.ok(rally.position().z < GATE.z - BALL_RADIUS)
    assert.deepEqual(cues.filter(cue => ['lotus', 'bell', 'passage'].includes(cue)), ['lotus', 'bell', 'passage'])
    rally.reset()
    assert.equal(rally.getStatus().ritual, 'lotus')
    assert.equal(rally.getStatus().phase, 'ready')
    assert.equal(rally['bell']?.isEnabled(), false)
    assert.equal(rally.aim, 0)
  } finally {
    rally.dispose()
  }
})

test('a return away from the bell continues the rally without opening the gate', () => {
  const rally = new Rally(() => {}, 'garden')
  try {
    openLotus(rally)
    rally.setAim(-2)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'incoming')
    assert.equal(rally.getStatus().returns, 0)
    assert.equal(rally.getStatus().ritual, 'bell')
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'miss')
    assert.equal(rally.getStatus().ritual, 'bell')
    rally.retry()
    assert.equal(rally.getStatus().phase, 'ready')
    assert.equal(rally.getStatus().ritual, 'bell')
    assert.equal(rally['bell']?.isEnabled(), true)
  } finally {
    rally.dispose()
  }
})

test('a wide shot drives the shadow return away from the lotus and leaves the bell locked', () => {
  const rally = new Rally(() => {}, 'garden')
  try {
    rally.setAim(2.65, -7.2)
    rally.swing()
    const outbound = rally.landing()!
    assert.ok(Math.abs(outbound.x - 2.65) < .04)
    assert.ok(Math.abs(outbound.z + 7.2) < .08)
    until(rally, () => rally.getStatus().phase === 'window')
    assert.equal(rally.getStatus().ritual, 'lotus')
    assert.equal(rally['bell']?.isEnabled(), false)
  } finally {
    rally.dispose()
  }
})

test('timing changes the return depth for the same aim', () => {
  function shot(delay: number) {
    const rally = new Rally(() => {}, 'garden')
    try {
      rally.swing()
      until(rally, () => rally.getStatus().phase === 'window')
      advance(rally, delay)
      rally.setAim(1.4, -6)
      rally.swing()
      return { quality: rally.getStatus().quality, landing: rally.landing()!, v: rally.velocity() }
    } finally {
      rally.dispose()
    }
  }
  const clean = shot(.23)
  const late = shot(.64)
  assert.equal(clean.quality, 'clean')
  assert.equal(late.quality, 'soft')
  assert.ok(late.landing.z - clean.landing.z > .5)
  assert.ok(Math.abs(clean.v.z) > Math.abs(late.v.z))
})


test('the admitted Aholo mountain seal geometry is the contact trigger for a valid return', {
  skip: !mountainSealCollision,
}, () => {
  assert.ok(mountainSealCollision)
  const hash = createHash('sha256').update(readFileSync(mountainSealCollision.source)).digest('hex')
  assert.equal(hash, mountainSealCollision.sourceSha256)

  const { x, z } = CLOUD_TERRACE.seals.right
  for (const disabled of [false, true]) {
    const rally = new Rally(() => {}, 'garden')
    try {
      ringBell(rally)
      rally.swing()
      until(rally, () => rally.getStatus().ritual === 'cleared')
      rally.enterMountain()
      rally.setAim(x, z)
      rally.swing()
      until(rally, () => rally.getStatus().phase === 'window')
      assert.equal(rally.getStatus().mountainSeal, 'right')

      if (disabled) rally['foldStones']!.right.setEnabled(false)
      advance(rally, .23)
      rally.swing()
      until(rally, () => rally.getStatus().phase === 'incoming')
      assert.equal(rally.getStatus().mountainHits ?? 0, disabled ? 0 : 1)
      assert.equal(rally.getStatus().mountainSeal, disabled ? 'right' : 'left')
    } finally {
      rally.dispose()
    }
  }
})

test('cloud terrace distinguishes the effective swing and both kinds of unscored contact', () => {
  for (const verdict of ['soft', 'wrong'] as const) {
    const rally = new Rally(() => {}, 'garden')
    try {
      ringBell(rally)
      rally.swing()
      until(rally, () => rally.getStatus().ritual === 'cleared')
      rally.enterMountain()
      const left = CLOUD_TERRACE.seals.left
      rally.setAim(left.x, left.z)
      rally.swing()
      until(rally, () => rally.getStatus().phase === 'window')
      assert.equal(rally.getStatus().mountainSeal, 'left')
      assert.equal(rally.getStatus().mountainWindow, 'live')
      if (verdict === 'soft') {
        until(rally, () => rally.getStatus().mountainWindow === 'late')
        assert.equal(rally.getStatus().phase, 'window')
      } else {
        advance(rally, .23)
      }
      const target = verdict === 'soft' ? left : CLOUD_TERRACE.seals.right
      rally.setAim(target.x, target.z)
      rally.swing()
      assert.equal(rally.getStatus().quality, verdict === 'soft' ? 'soft' : 'clean')
      until(rally, () => rally.getStatus().sealContact === verdict)
      assert.equal(rally.getStatus().mountainHits ?? 0, 0)
      rally.retry()
      assert.equal(rally.getStatus().mountainWindow, undefined)
      assert.equal(rally.getStatus().sealContact, undefined)
    } finally {
      rally.dispose()
    }
  }
})

test('the ball opens the real route, unfolds the ridge and reaches the moon only through the sky aperture', () => {
  const rally = new Rally(() => {}, 'garden')
  try {
    rally.enterMountain()
    assert.equal(rally.getStatus().ritual, 'lotus')
    ringBell(rally)
    rally.swing()
    until(rally, () => rally.getStatus().ritual === 'cleared')
    rally.enterMountain()
    const arrived = rally.position()
    const tee = CLOUD_TERRACE.tee
    assert.ok(Math.hypot(arrived.x - tee.x, arrived.y - tee.y, arrived.z - tee.z) < .001)
    assert.ok(rally['mountainColliders'].every(collider => !collider.isEnabled()))

    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'miss')
    assert.equal(rally.getStatus().ritual, 'mountain')
    rally.enterSummit()
    assert.equal(rally.getStatus().ritual, 'mountain')
    rally.retry()
    rally.setAim(CLOUD_TERRACE.seals.left.x, CLOUD_TERRACE.seals.left.z)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'window')
    assert.equal(rally.getStatus().ritual, 'mountain')
    assert.equal(rally.getStatus().mountainSeal, 'left')
    assert.ok(rally.lastShadowSwing > 0)
    assert.ok(Math.abs(rally.landing()!.y - CLOUD_TERRACE.y) < .001)
    rally.setAim(CLOUD_TERRACE.seals.right.x, CLOUD_TERRACE.seals.right.z)
    advance(rally, .23)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'incoming')
    assert.equal(rally.getStatus().ritual, 'mountain')
    assert.equal(rally.getStatus().returns, 1)
    assert.equal(rally.getStatus().mountainSeal, 'left')
    rally.retry()
    assert.equal(rally.getStatus().phase, 'ready')
    assert.equal(rally.getStatus().returns, 0)
    assert.equal(rally.getStatus().mountainSeal, undefined)
    rally.setAim(CLOUD_TERRACE.seals.right.x, CLOUD_TERRACE.seals.right.z)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'window')
    assert.equal(rally.getStatus().mountainSeal, 'right')
    rally.setAim(CLOUD_TERRACE.seals.right.x, CLOUD_TERRACE.seals.right.z)
    advance(rally, .23)
    rally.swing()
    until(rally, () => rally.getStatus().mountainHits === 1)
    assert.equal(rally.getStatus().mountainSeal, 'left')
    assert.equal(rally.getStatus().ritual, 'mountain')
    until(rally, () => rally.getStatus().phase === 'window')
    advance(rally, .23)
    rally.setAim(CLOUD_TERRACE.seals.left.x, CLOUD_TERRACE.seals.left.z)
    rally.swing()
    until(rally, () => rally.getStatus().ritual === 'unfolding')
    assert.ok(rally['mountainColliders'].every(collider => !collider.isEnabled()))

    rally.enterSummit()
    assert.ok(rally['mountainColliders'].every(collider => collider.isEnabled()))
    assert.ok(rally['moonReceiver']!.isEnabled())
    rally.swing()
    rally['ball'].setTranslation({x: SUMMIT.x, y: SUMMIT.y + 1.6, z: SUMMIT.z}, true)
    rally['ball'].setLinvel({x: 0, y: -13, z: 0}, true)
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'sky-miss')
    assert.ok(rally.position().y > SUMMIT.y + .10, 'ball contacts the sculpted terrace above the underlying terrain')
    rally.retry()
    rally.setAim(4.5, SUMMIT.aperture.z, 16.5)
    assert.equal(rally.skyAimCentered(), false)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().ritual, 'summit')
    assert.equal(rally.getStatus().fault, 'sky-miss')
    rally.retry()
    const { aperture } = SUMMIT
    rally.setAim(aperture.x + aperture.radius + .15, aperture.z, aperture.y)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'sky-rim')
    rally.retry()
    rally.setAim(aperture.x, aperture.z, aperture.y - .39)
    assert.equal(rally.skyAimCentered(), false)
    rally.swing()
    until(rally, () => rally.getStatus().phase === 'ended')
    assert.equal(rally.getStatus().fault, 'sky-rim')
    assert.ok(rally.position().z < aperture.z, 'ball reaches the far side of the rim before colliding')
    rally.retry()
    const { x, y, z } = SUMMIT.aperture
    rally.setAim(x, z, y)
    assert.equal(rally.skyAimCentered(), true)
    assert.deepEqual(rally.skyShotPoint(1, rally.position()), {x,y,z})
    rally.swing()
    until(rally, () => rally.getStatus().ritual === 'moonrise')
    assert.ok(rally.position().z + BALL_RADIUS < z - aperture.depth / 2)
    rally.finishPainting()
    assert.equal(rally.getStatus().ritual, 'moonrise')
    advance(rally, 2.6)
    rally.finishPainting()
    assert.equal(rally.getStatus().ritual, 'ending')
    const moon = rally.position()
    assert.ok(Math.hypot(moon.x - SUMMIT.moon.x, moon.y - SUMMIT.moon.y, moon.z - SUMMIT.moon.z) < .001)
    rally.reset()
    assert.equal(rally.getStatus().ritual, 'lotus')
    assert.equal(rally.moonProgress(), 0)
    assert.ok(rally['mountainColliders'].every(collider => !collider.isEnabled()))
  } finally {
    rally.dispose()
  }
})


test('the gameplay bell collision is derived from the exact runtime Aholo GLB', () => {
  const source = readFileSync(new URL('../public/assets/models/stone-bell.glb', import.meta.url))
  assert.equal(createHash('sha256').update(source).digest('hex'), stoneBellCollision.sourceSha256)
  assert.equal(stoneBellCollision.taskId, '8211698')
  const top = Math.max(...stoneBellCollision.vertices.map(point => point[1]))
  const bottom = Math.min(...stoneBellCollision.vertices.map(point => point[1]))
  assert.ok(Math.abs(top - 1.1) < .00001)
  assert.ok(Math.abs(bottom) < .00001)
})

test('the aperture uses an open three-dimensional mesh baked from the runtime Aholo moon gate', () => {
  const bytes = readFileSync(moonGateCollision.source)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), moonGateCollision.sourceSha256)
  assert.equal(moonGateCollision.indices.length / 3, moonGateCollision.triangles)
  assert.ok(moonGateCollision.bounds.min[2] < -.5 && moonGateCollision.bounds.max[2] > .5)
})
