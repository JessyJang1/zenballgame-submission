import { useLoader } from '@react-three/fiber'
import { Texture, TextureLoader } from 'three'

// Share Drei's TextureLoader cache. Schedule GPU uploads at the opening's actual
// render boundary instead of flushing them all from the React mount effects.
export function useSceneTexture(input: string): Texture
export function useSceneTexture(input: string[]): Texture[]
export function useSceneTexture(input: string | string[]): Texture | Texture[] {
  return useLoader(TextureLoader,input) as Texture | Texture[]
}
