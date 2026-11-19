import { moonGateCollision } from './moonGateCollision'
import { mountainSealCollision } from './mountainSealCollision'

// Runtime admission is separate from generation success and automated technical QA.
export type Model = { file: string; scale?: number; taskId?: string; review: string; evidence: string }
const slots = ['player', 'shadow', 'racket', 'ball', 'lotus', 'lotusPetal', 'bell', 'bellMount', 'gateAscent', 'gateShoulder', 'gateFrame', 'courtyardRoof', 'thresholdPlug',
  'gateDoorLeft', 'gateDoorRight', 'path', 'court', 'screen', 'landscape', 'pine', 'lantern', 'mountainSeal', 'moonGate'] as const
export type Catalog = Partial<Record<typeof slots[number], Model>>

export function admittedModels(input: unknown): Catalog {
  const result: Catalog = {}
  if (!input || typeof input !== 'object' || !('version' in input) || input.version !== 1 ||
    !('models' in input) || !input.models || typeof input.models !== 'object') return result
  for (const slot of slots) {
    const model = (input.models as Record<string, unknown>)[slot]
    if (!model || typeof model !== 'object' || !('file' in model) || typeof model.file !== 'string' ||
      !/^models\/(?:[\w-]+\/)*[\w.-]+\.glb$/i.test(model.file)) continue
    if (!('review' in model) || !('evidence' in model) || typeof model.evidence !== 'string' || !model.evidence.trim()) continue
    // Rejected standing character remains excluded even if a manifest entry is accidentally restored.
    if (model.file.includes('racket-holder') || ('taskId' in model && String(model.taskId) === '8214196')) continue
    const retainedBell = slot === 'bell' && model.file === 'models/stone-bell.glb' &&
      'taskId' in model && String(model.taskId) === '8211698' && model.review === 'baseline-retained'
    const candidate = 'stage' in input && input.stage === 'candidate' && model.review === 'local-visual-pass' &&
      (['gateFrame','gateDoorLeft','gateDoorRight','bell','bellMount'].includes(slot) ||
       (slot === 'gateShoulder' && model.file === 'models/gate-ledge-8354532.glb' && 'taskId' in model && model.taskId === '8354532') ||
       (slot === 'gateAscent' && model.file === 'models/gate-ascent.glb') ||
       (slot === 'path' && model.file === 'models/gate-causeway.glb'))
    // The seal renderer must use the model from which its hit surface was baked.
    if (slot === 'moonGate' && (moonGateCollision.source !== 'public/assets/' + model.file ||
      !('taskId' in model) || model.taskId !== moonGateCollision.taskId)) continue
    if (slot === 'mountainSeal' && (!mountainSealCollision ||
      mountainSealCollision.source !== 'public/assets/' + model.file ||
      !('taskId' in model) || model.taskId !== mountainSealCollision.taskId)) continue
    // A successful provider delivery never promotes a core candidate.
    if ((slot === 'lotusPetal' || slot === 'courtyardRoof' || slot === 'thresholdPlug' || slot === 'mountainSeal' || slot === 'moonGate') && (model.review !== 'visually-approved' ||
      !('taskId' in model) || typeof model.taskId !== 'string' || !/^\d+$/.test(model.taskId))) continue
    if (model.review !== 'visually-approved' && !retainedBell && !candidate) continue
    result[slot] = model as Model
  }
  return result
}
