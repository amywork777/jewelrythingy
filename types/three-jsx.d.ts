import { Group, AmbientLight, DirectionalLight } from 'three'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any
      ambientLight: any
      directionalLight: any
    }
  }
} 