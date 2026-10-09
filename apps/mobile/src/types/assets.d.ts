/** Static image imports resolved by Metro (require/import of .png files). */
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
