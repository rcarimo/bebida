import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'chart'
  | 'back'
  | 'chevron'
  | 'plus'
  | 'check'
  | 'beer'
  | 'user'
  | 'calendar'
  | 'trash'
  | 'cloud'
  | 'left'
  | 'right';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'chart' && (
        <>
          <Path d="M4 20V10" {...p} />
          <Path d="M10 20V4" {...p} />
          <Path d="M16 20v-7" {...p} />
          <Path d="M22 20H2" {...p} />
        </>
      )}
      {(name === 'back' || name === 'left') && <Path d="M15 6l-6 6 6 6" {...p} />}
      {(name === 'chevron' || name === 'right') && <Path d="M9 6l6 6-6 6" {...p} />}
      {name === 'plus' && (
        <>
          <Path d="M12 5v14" {...p} />
          <Path d="M5 12h14" {...p} />
        </>
      )}
      {name === 'check' && <Path d="M5 12l5 5L20 7" {...p} />}
      {name === 'beer' && (
        <>
          <Path d="M5 7h10v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" {...p} />
          <Path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" {...p} />
          <Path d="M5 7c0-2 1.5-3 3-3 .8-1 2-1.5 3-1 1.2-.5 3 .3 3.5 1.5C16 5 15 7 15 7" {...p} />
        </>
      )}
      {name === 'user' && (
        <>
          <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" {...p} />
          <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" {...p} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} {...p} />
          <Path d="M3 10h18" {...p} />
          <Path d="M8 3v4" {...p} />
          <Path d="M16 3v4" {...p} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16" {...p} />
          <Path d="M10 11v6M14 11v6" {...p} />
          <Path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" {...p} />
          <Path d="M9 7V4h6v3" {...p} />
        </>
      )}
      {name === 'cloud' && <Path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z" {...p} />}
    </Svg>
  );
}
