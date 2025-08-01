import { Object3D, Group, Light, DirectionalLight, AmbientLight } from 'three'

// Extend the JSX namespace for react-three-fiber components
declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: any
      group: any 
      ambientLight: any
      directionalLight: any
      mesh: any
      spotLight: any
      pointLight: any
    }
  }
}

// Declare modules for react-three-fiber
declare module '@react-three/fiber' {
  export interface ThreeElements {
    primitive: { object: Object3D } & JSX.IntrinsicElements['primitive']
    group: { ref?: React.RefObject<Group> } & JSX.IntrinsicElements['group']
    ambientLight: { intensity?: number } & JSX.IntrinsicElements['ambientLight']
    directionalLight: { 
      position?: [number, number, number] 
      intensity?: number
      castShadow?: boolean
    } & JSX.IntrinsicElements['directionalLight']
  }
} 